from sqlalchemy.orm import Session, selectinload
from app.modules.promotions.models import Promotion, PromotionProduct, PromotionRedemption, RedemptionStatus


class PromotionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, artisan_id, **fields) -> Promotion:
        promo = Promotion(artisan_id=artisan_id, **fields)
        self.db.add(promo)
        self.db.flush()
        return promo

    def add_products(self, promotion_id, product_ids: list) -> None:
        for pid in product_ids:
            self.db.add(PromotionProduct(promotion_id=promotion_id, product_id=pid))
        self.db.flush()

    def get_by_code_for_update(self, code: str) -> Promotion | None:
        return (
            self.db.query(Promotion)
            .filter(Promotion.code == code)
            .options(selectinload(Promotion.eligible_products))
            .with_for_update()
            .first()
        )

    def count_active_redemptions(self, promotion_id) -> int:
        return (
            self.db.query(PromotionRedemption)
            .filter(
                PromotionRedemption.promotion_id == promotion_id,
                PromotionRedemption.status.in_([RedemptionStatus.RESERVED, RedemptionStatus.CONFIRMED]),
            )
            .count()
        )

    def create_redemption(self, promotion_id, checkout_id, discount_amount, customer_id=None) -> PromotionRedemption:
        redemption = PromotionRedemption(
            promotion_id=promotion_id,
            checkout_id=checkout_id,
            customer_id=customer_id,
            discount_amount=discount_amount,
            status=RedemptionStatus.RESERVED,
        )
        self.db.add(redemption)
        self.db.flush()
        return redemption

    def get_redemption_by_checkout(self, checkout_id) -> PromotionRedemption | None:
        return self.db.query(PromotionRedemption).filter(PromotionRedemption.checkout_id == checkout_id).first()

    def list_by_artisan(self, artisan_id) -> list[Promotion]:
        return (
            self.db.query(Promotion)
            .filter(Promotion.artisan_id == artisan_id)
            .options(selectinload(Promotion.eligible_products))
            .all()
        )