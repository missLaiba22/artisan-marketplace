# app/modules/orders/repository.py
from sqlalchemy.orm import Session
from app.modules.orders.models import Checkout, Order, OrderItem, PaymentStatus


class CheckoutRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, customer_id, total_amount) -> Checkout:
        checkout = Checkout(
            customer_id=customer_id,
            total_amount=total_amount,
            payment_status=PaymentStatus.PENDING,
        )
        self.db.add(checkout)
        self.db.flush()
        return checkout

    def get_by_id(self, checkout_id) -> Checkout | None:
        return self.db.query(Checkout).filter(Checkout.id == checkout_id).first()


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, checkout_id, artisan_id) -> Order:
        order = Order(checkout_id=checkout_id, artisan_id=artisan_id)
        self.db.add(order)
        self.db.flush()
        return order

    def get_by_id(self, order_id) -> Order | None:
        return self.db.query(Order).filter(Order.id == order_id).first()

    def list_by_artisan(self, artisan_id) -> list[Order]:
        return self.db.query(Order).filter(Order.artisan_id == artisan_id).all()

    def list_by_checkout(self, checkout_id) -> list[Order]:
        return self.db.query(Order).filter(Order.checkout_id == checkout_id).all()


class OrderItemRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, order_id, product_id, product_name: str, unit_price, quantity: int) -> OrderItem:
        item = OrderItem(
            order_id=order_id,
            product_id=product_id,
            product_name=product_name,
            unit_price=unit_price,
            quantity=quantity,
        )
        self.db.add(item)
        self.db.flush()
        return item

    def list_by_order(self, order_id) -> list[OrderItem]:
        return self.db.query(OrderItem).filter(OrderItem.order_id == order_id).all()