# app/modules/orders/service.py
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.modules.orders.repository import CheckoutRepository, OrderRepository, OrderItemRepository
from app.modules.orders.schemas import CheckoutRequest
from app.modules.orders.models import PaymentStatus
from app.modules.products.repository import ProductRepository


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.checkout_repo = CheckoutRepository(db)
        self.order_repo = OrderRepository(db)
        self.item_repo = OrderItemRepository(db)
        self.product_repo = ProductRepository(db)

    def create_order(self, customer_id, data: CheckoutRequest):
        # --- Step 1: LOCK before validating (sub-decision 3) ---
        # Lock every product row up front, in one pass, before trusting any
        # stock_quantity value. This closes the race window completely —
        # no other checkout can touch these rows until we commit or fail.
        locked_products = {}
        for item in data.items:
            product = self.product_repo.get_by_id_for_update(item.product_id)
            if product is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"Product {item.product_id} not found")
            if not product.is_active:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Product '{product.name}' is no longer available")
            locked_products[item.product_id] = product

        # --- Step 2: validate stock (now safe, values are locked/fresh) ---
        for item in data.items:
            product = locked_products[item.product_id]
            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Insufficient stock for '{product.name}': requested {item.quantity}, available {product.stock_quantity}",
                )

        # --- Step 3: compute total (server-side, never trust client total) ---
        total_amount = sum(
            locked_products[item.product_id].price * item.quantity
            for item in data.items
        )

        # --- Step 4: create Checkout (parent record) ---
        checkout = self.checkout_repo.create(customer_id=customer_id, total_amount=total_amount)

        # --- Step 5: group items by artisan_id (sub-decision 1 — one Order per artisan) ---
        items_by_artisan: dict = {}
        for item in data.items:
            product = locked_products[item.product_id]
            items_by_artisan.setdefault(product.artisan_id, []).append((product, item.quantity))

        # --- Step 6: create one Order per artisan, with snapshotted OrderItems ---
        for artisan_id, product_items in items_by_artisan.items():
            order = self.order_repo.create(checkout_id=checkout.id, artisan_id=artisan_id)
            for product, quantity in product_items:
                self.item_repo.create(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,      # snapshot (sub-decision 2)
                    unit_price=product.price,        # snapshot (sub-decision 2)
                    quantity=quantity,
                )
                # --- Step 7: decrement stock on the locked row ---
                product.stock_quantity -= quantity

        # --- Step 8: mock payment — flip to PAID within the same transaction ---
        checkout.payment_status = PaymentStatus.PAID
        checkout.payment_reference = f"MOCK-{checkout.id}"

        # --- Step 9: single commit — everything succeeds together or nothing persists ---
        self.db.commit()
        self.db.refresh(checkout)
        return checkout

    def list_orders_for_artisan(self, artisan_id):
        return self.order_repo.list_by_artisan(artisan_id)

    def list_checkouts_for_customer(self, customer_id, limit: int = 10):
        return self.checkout_repo.list_by_customer(customer_id, limit=limit)

    def get_latest_checkout_for_customer(self, customer_id):
        return self.checkout_repo.get_latest_by_customer(customer_id)