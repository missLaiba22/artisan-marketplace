# app/modules/orders/service.py
import stripe
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.modules.orders.repository import CheckoutRepository, OrderRepository, OrderItemRepository
from app.modules.orders.schemas import CheckoutRequest
from app.modules.orders.models import PaymentStatus, OrderStatus
from app.modules.products.repository import ProductRepository
from decimal import Decimal, ROUND_HALF_UP
from app.modules.promotions.service import PromotionService
import logging



logger = logging.getLogger(__name__)

stripe.api_key = settings.stripe_secret_key


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.checkout_repo = CheckoutRepository(db)
        self.order_repo = OrderRepository(db)
        self.item_repo = OrderItemRepository(db)
        self.product_repo = ProductRepository(db)
        self.promotion_service = PromotionService(db)
    def create_order(self, customer_id, data: CheckoutRequest):
        # Canonical lock order — sort by product_id before locking, so two
        # concurrent checkouts sharing products always acquire locks in the
        # same order regardless of client-submitted array order. Closes a
        # pre-existing deadlock gap (architecture review point 5), unrelated
        # to promos but cheap to fix while this method is already open.
        sorted_items = sorted(data.items, key=lambda i: str(i.product_id))

        locked_products = {}
        for item in sorted_items:
            product = self.product_repo.get_by_id_for_update(item.product_id)
            if product is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"Product {item.product_id} not found")
            if not product.is_active:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Product '{product.name}' is no longer available")
            locked_products[item.product_id] = product

        for item in sorted_items:
            product = locked_products[item.product_id]
            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Insufficient stock for '{product.name}': requested {item.quantity}, available {product.stock_quantity}",
                )

        # Promo locked AFTER products, always — fixed lock order relative
        # to products (architecture review point 5).
        promo, eligible_product_ids = None, set()
        if data.promo_code:
            cart_product_ids = {item.product_id for item in sorted_items}
            promo, eligible_product_ids = self.promotion_service.validate_and_lock(data.promo_code, cart_product_ids)

        items_by_artisan: dict = {}
        for item in sorted_items:
            product = locked_products[item.product_id]
            items_by_artisan.setdefault(product.artisan_id, []).append((product, item.quantity))

        # --- COMPUTE PASS (pure, in-memory, Decimal-only) ---
        # No DB writes here. Determines charged_total and discounted_unit_price
        # per line BEFORE anything is persisted, so Checkout can be created
        # once with its real, final total_amount — no placeholder mutation
        # (architecture review point 8).
        if promo:
            eligible_lines = [
                {"product_id": product.id, "unit_price": product.price, "quantity": quantity}
                for artisan_id, product_items in items_by_artisan.items()
                for product, quantity in product_items
                if product.id in eligible_product_ids
            ]
            discounts = self.promotion_service.compute_discounts(promo, eligible_lines)
        else:
            discounts = {}

        computed_lines = []  # one entry per (artisan_id, product, quantity, charged_total, discount_info)
        total_amount = Decimal("0.00")
        total_discount = Decimal("0.00")
        for artisan_id, product_items in items_by_artisan.items():
            for product, quantity in product_items:
                original_line_subtotal = product.price * quantity
                if product.id in discounts:
                    line_discount = discounts[product.id]["line_discount"]
                    charged_total = discounts[product.id]["charged_total"]
                    total_discount += line_discount
                else:
                    charged_total = original_line_subtotal
                computed_lines.append({
                    "artisan_id": artisan_id, "product": product, "quantity": quantity,
                    "charged_total": charged_total,
                    "promotion_id": promo.id if product.id in discounts else None,
                })
                total_amount += charged_total  # Decimal end-to-end, never derived from Stripe's int cents

        # --- PERSIST PASS ---
        checkout = self.checkout_repo.create(customer_id=customer_id, total_amount=total_amount)

        line_items = []
        orders_by_artisan = {}
        for line in computed_lines:
            artisan_id = line["artisan_id"]
            if artisan_id not in orders_by_artisan:
                orders_by_artisan[artisan_id] = self.order_repo.create(checkout_id=checkout.id, artisan_id=artisan_id)
            order = orders_by_artisan[artisan_id]
            product, quantity = line["product"], line["quantity"]
            charged_total = line["charged_total"]

            discounted_unit_price = None
            if line["promotion_id"] is not None:
                # Per-unit value for the receipt only — the amount actually
                # charged to Stripe uses charged_total directly (see below),
                # so this can't leak money even if it doesn't divide evenly
                # per unit (architecture review point 2 caveat).
                discounted_unit_price = (charged_total / quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            self.item_repo.create(
                order_id=order.id, product_id=product.id, product_name=product.name,
                unit_price=product.price, discounted_unit_price=discounted_unit_price,
                promotion_id=line["promotion_id"], quantity=quantity,
            )
            product.stock_quantity -= quantity

            # quantity=1 + unit_amount=full line total — sidesteps needing
            # Stripe's per-unit amount to divide evenly out of a discounted
            # line total. The exact amount charged always matches charged_total.
            cents = int((charged_total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"{product.name} x{quantity}"},
                    "unit_amount": cents,
                },
                "quantity": 1,
            })

        if promo:
            self.promotion_service.record_reservation(promo, checkout.id, customer_id, total_discount)

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
            # Explicit rollback — was implicit-via-session-close before.
            # Same atomicity outcome, now visible in the code rather than
            # inferred from get_db()'s teardown behavior (architecture
            # review point 4).
            self.db.rollback()
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"Could not start payment: {e.user_message or 'please try again'}",
            )

        checkout.stripe_session_id = session.id
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

    def get_checkout_by_session_id(self, customer_id, stripe_session_id: str):
        checkout = self.checkout_repo.get_by_stripe_session_id(stripe_session_id)
        if checkout is None or checkout.customer_id != customer_id:
        # Same 403-vs-404 reasoning as products/artisans: a session_id
        # belonging to someone else should not be distinguishable from
        # one that doesn't exist — don't leak "this session exists but
        # isn't yours" to an unauthenticated-feeling probe.
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Checkout not found")
        return  checkout

    def mark_checkout_paid(self, stripe_session_id: str):
        checkout = self.checkout_repo.get_by_stripe_session_id(stripe_session_id)
        if checkout is None:
            logger.warning(
                "Stripe webhook checkout.session.completed for unknown "
                "stripe_session_id=%s — payment may be lost if this "
                "session should have existed in our DB",
                stripe_session_id,
            )
            return
        if checkout.payment_status == PaymentStatus.PAID:
            return
        checkout.payment_status = PaymentStatus.PAID
        self.promotion_service.confirm_redemption(checkout.id)  # NEW
        self.db.commit()

    def mark_checkout_expired(self, stripe_session_id: str):
        checkout = self.checkout_repo.get_by_stripe_session_id(stripe_session_id)
        if checkout is None:
            # Same reasoning as mark_checkout_paid above — log instead of
            # failing silently, don't raise (would cause infinite Stripe retries).
            logger.warning(
                "Stripe webhook checkout.session.expired for unknown "
                "stripe_session_id=%s — expiry could not be applied",
                stripe_session_id,
            )
            return
        if checkout.payment_status != PaymentStatus.PENDING:
            return  # already paid, or already expired — don't re-release stock

        for order in self.order_repo.list_by_checkout(checkout.id):
            items = sorted(self.item_repo.list_by_order(order.id), key=lambda i: str(i.product_id))
            for item in items:
                product = self.product_repo.get_by_id_for_update(item.product_id)
                if product is not None:
                    product.stock_quantity += item.quantity
            order.status = OrderStatus.CANCELLED

        checkout.payment_status = PaymentStatus.EXPIRED
        self.promotion_service.release_redemption(checkout.id)  # NEW
        self.db.commit()