from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.modules.promotions.repository import PromotionRepository
from app.modules.promotions.schemas import PromotionCreateRequest
from app.modules.promotions.models import DiscountType, RedemptionStatus
from app.modules.products.repository import ProductRepository

TWO_PLACES = Decimal("0.01")


class PromotionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PromotionRepository(db)
        self.product_repo = ProductRepository(db)

    # --- Artisan-facing CRUD ---

    def create(self, artisan_id, data: PromotionCreateRequest):
        for product_id in data.product_ids:
            product = self.product_repo.get_by_id(product_id)
            if product is None or product.artisan_id != artisan_id:
                raise HTTPException(status.HTTP_403_FORBIDDEN, f"Product {product_id} does not belong to you")
        try:
            promo = self.repo.create(
                artisan_id=artisan_id,
                code=data.code.upper(),
                discount_type=data.discount_type,
                discount_value=data.discount_value,
                starts_at=data.starts_at,
                ends_at=data.ends_at,
                max_uses=data.max_uses,
            )
            self.repo.add_products(promo.id, data.product_ids)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "That code already exists")
        self.db.refresh(promo)
        return promo

    def list_my_promotions(self, artisan_id):
        return self.repo.list_by_artisan(artisan_id)

    # --- Checkout-time validation + reservation ---

    def validate_and_lock(self, code: str, cart_product_ids: set):
        promo = self.repo.get_by_code_for_update(code.upper())
        if promo is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid promo code")
        if not promo.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This promo code is no longer active")

        now = datetime.now(timezone.utc)
        if promo.starts_at and promo.starts_at > now:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This promo code is not active yet")
        if promo.ends_at and promo.ends_at < now:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This promo code has expired")

        eligible_ids = {ep.product_id for ep in promo.eligible_products}
        matched_ids = eligible_ids & cart_product_ids
        if not matched_ids:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This promo code isn't valid for any items in your cart")

        if promo.max_uses is not None and self.repo.count_active_redemptions(promo.id) >= promo.max_uses:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This promo code has reached its usage limit")

        return promo, matched_ids

    def compute_discounts(self, promo, eligible_lines: list[dict]) -> dict:
        """
        eligible_lines: [{"product_id": UUID, "unit_price": Decimal, "quantity": int}, ...]
        Returns: {product_id: {"line_discount": Decimal, "charged_total": Decimal}}

        PERCENTAGE applies independently per line — no cross-item allocation needed.
        FIXED applies to the TOTAL eligible subtotal (capped at that subtotal),
        allocated proportionally across eligible lines, with the LAST line
        absorbing the rounding remainder so allocated amounts always sum exactly
        to the total discount (architecture review point 2).
        """
        result = {}

        if promo.discount_type == DiscountType.PERCENTAGE:
            for line in eligible_lines:
                line_subtotal = line["unit_price"] * line["quantity"]
                line_discount = (line_subtotal * promo.discount_value / 100).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
                result[line["product_id"]] = {"line_discount": line_discount, "charged_total": line_subtotal - line_discount}
            return result

        # FIXED
        eligible_subtotal = sum((l["unit_price"] * l["quantity"] for l in eligible_lines), Decimal("0.00"))
        total_discount = min(promo.discount_value, eligible_subtotal)

        allocated = Decimal("0.00")
        for i, line in enumerate(eligible_lines):
            line_subtotal = line["unit_price"] * line["quantity"]
            is_last = i == len(eligible_lines) - 1
            if is_last:
                line_discount = total_discount - allocated
            else:
                share = (line_subtotal / eligible_subtotal) if eligible_subtotal > 0 else Decimal("0")
                line_discount = (total_discount * share).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
                allocated += line_discount
            result[line["product_id"]] = {"line_discount": line_discount, "charged_total": line_subtotal - line_discount}
        return result

    def record_reservation(self, promo, checkout_id, customer_id, total_discount: Decimal):
        self.repo.create_redemption(promo.id, checkout_id, total_discount, customer_id=customer_id)

    # --- Webhook-driven lifecycle transitions (idempotent, same pattern as mark_checkout_paid/expired) ---

    def confirm_redemption(self, checkout_id):
        redemption = self.repo.get_redemption_by_checkout(checkout_id)
        if redemption is None or redemption.status != RedemptionStatus.RESERVED:
            return
        redemption.status = RedemptionStatus.CONFIRMED
        redemption.promotion.times_used += 1

    def release_redemption(self, checkout_id):
        redemption = self.repo.get_redemption_by_checkout(checkout_id)
        if redemption is None or redemption.status != RedemptionStatus.RESERVED:
            return
        redemption.status = RedemptionStatus.RELEASED