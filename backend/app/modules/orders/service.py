# app/modules/orders/service.py
import stripe
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.modules.orders.repository import CheckoutRepository, OrderRepository, OrderItemRepository
from app.modules.orders.schemas import CheckoutRequest
from app.modules.orders.models import PaymentStatus, OrderStatus
from app.modules.products.repository import ProductRepository

stripe.api_key = settings.stripe_secret_key


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.checkout_repo = CheckoutRepository(db)
        self.order_repo = OrderRepository(db)
        self.item_repo = OrderItemRepository(db)
        self.product_repo = ProductRepository(db)

    def create_order(self, customer_id, data: CheckoutRequest):
        # --- Steps 1-7: UNCHANGED from the mock flow ---
        # Lock → validate stock → compute total → create Checkout → group
        # by artisan → create Orders + OrderItems → decrement stock.
        # This is still the point where stock gets reserved (Q1: option A).
        locked_products = {}
        for item in data.items:
            product = self.product_repo.get_by_id_for_update(item.product_id)
            if product is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"Product {item.product_id} not found")
            if not product.is_active:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Product '{product.name}' is no longer available")
            locked_products[item.product_id] = product

        for item in data.items:
            product = locked_products[item.product_id]
            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Insufficient stock for '{product.name}': requested {item.quantity}, available {product.stock_quantity}",
                )

        total_amount = sum(
            locked_products[item.product_id].price * item.quantity
            for item in data.items
        )

        checkout = self.checkout_repo.create(customer_id=customer_id, total_amount=total_amount)
        # payment_status stays PENDING — CheckoutRepository.create() already
        # defaults it that way, nothing to change here.

        items_by_artisan: dict = {}
        for item in data.items:
            product = locked_products[item.product_id]
            items_by_artisan.setdefault(product.artisan_id, []).append((product, item.quantity))

        # line_items accumulates alongside order creation — same loop,
        # one extra list being built, since we need Stripe's view of the
        # cart (name/price/qty) and we already have every product in hand.
        line_items = []
        for artisan_id, product_items in items_by_artisan.items():
            order = self.order_repo.create(checkout_id=checkout.id, artisan_id=artisan_id)
            # Order.status stays PENDING (its existing default) — that field
            # answers "what's happened to this order," not "is it paid."
            for product, quantity in product_items:
                self.item_repo.create(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,
                    unit_price=product.price,
                    quantity=quantity,
                )
                product.stock_quantity -= quantity  # reserved now, per Q1

                line_items.append({
                    "price_data": {
                        "currency": "usd",  # TODO: revisit if PKR support matters later
                        "product_data": {"name": product.name},
                        "unit_amount": int(product.price * 100),  # dollars -> cents
                    },
                    "quantity": quantity,
                })

        # --- Step 8: create the Stripe Checkout Session ---
        # This replaces the old "mock-mark PAID" step. We flush (not
        # commit) first so checkout.id exists and is visible for the
        # idempotency key and success_url, but nothing is durable yet —
        # if Stripe's API call fails, the whole transaction still rolls
        # back cleanly on the exception, same atomicity guarantee as before.
        self.db.flush()

        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                line_items=line_items,
                success_url=f"{settings.frontend_url}/order-confirmation?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.frontend_url}/cart",
                expires_at=self._session_expiry_timestamp(),
                metadata={"checkout_id": str(checkout.id)},
                idempotency_key=f"checkout-{checkout.id}",
            )
        except stripe.StripeError as e:
            # Anything from a bad API key to a Stripe-side outage lands here.
            # The whole transaction rolls back (nothing was committed yet) —
            # stock reservation and the Checkout/Order rows all vanish
            # together, exactly the atomicity guarantee DECISIONS.md already
            # established for this method.
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"Could not start payment: {e.user_message or 'please try again'}",
            )

        checkout.stripe_session_id = session.id

        # --- Step 9: single commit — same rule as before, new content ---
        self.db.commit()
        self.db.refresh(checkout)
        return checkout, session.url

    def _session_expiry_timestamp(self) -> int:
        from datetime import datetime, timedelta, timezone
        expiry = datetime.now(timezone.utc) + timedelta(minutes=settings.stripe_session_expires_minutes)
        return int(expiry.timestamp())

    def list_orders_for_artisan(self, artisan_id):
        return self.order_repo.list_by_artisan(artisan_id)

    def list_checkouts_for_customer(self, customer_id, limit: int = 10):
        return self.checkout_repo.list_by_customer(customer_id, limit=limit)

    def get_latest_checkout_for_customer(self, customer_id):
        return self.checkout_repo.get_latest_by_customer(customer_id)
    def mark_checkout_paid(self, stripe_session_id: str):
        checkout = self.checkout_repo.get_by_stripe_session_id(stripe_session_id)
        if checkout is None:
            # Shouldn't happen if session_id was stored correctly at
            # creation — but a missing row must not crash the handler,
            # or Stripe will retry this event forever.
            return
        if checkout.payment_status == PaymentStatus.PAID:
            return  # idempotent no-op — duplicate/retried webhook
        checkout.payment_status = PaymentStatus.PAID
        self.db.commit()

    def mark_checkout_expired(self, stripe_session_id: str):
        checkout = self.checkout_repo.get_by_stripe_session_id(stripe_session_id)
        if checkout is None:
            return
        if checkout.payment_status != PaymentStatus.PENDING:
            return  # already paid, or already expired — don't re-release stock

        for order in self.order_repo.list_by_checkout(checkout.id):
            for item in self.item_repo.list_by_order(order.id):
                # Lock the same way checkout does — a product could be mid
                # -checkout in another transaction right now.
                product = self.product_repo.get_by_id_for_update(item.product_id)
                if product is not None:
                    product.stock_quantity += item.quantity
            order.status = OrderStatus.CANCELLED

        checkout.payment_status = PaymentStatus.EXPIRED
        self.db.commit()