from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.artisans.dependencies import require_approved_artisan
from app.modules.promotions.schemas import PromotionCreateRequest, PromotionResponse
from app.modules.promotions.service import PromotionService

router = APIRouter(prefix="/promotions", tags=["promotions"])


def _to_response(promo) -> PromotionResponse:
    return PromotionResponse(
        id=promo.id, artisan_id=promo.artisan_id, code=promo.code,
        discount_type=promo.discount_type, discount_value=promo.discount_value,
        starts_at=promo.starts_at, ends_at=promo.ends_at, max_uses=promo.max_uses,
        times_used=promo.times_used, is_active=promo.is_active, created_at=promo.created_at,
        product_ids=[ep.product_id for ep in promo.eligible_products],
    )


@router.get("/me", response_model=list[PromotionResponse])
def list_my_promotions(artisan=Depends(require_approved_artisan), db: Session = Depends(get_db)):
    return [_to_response(p) for p in PromotionService(db).list_my_promotions(artisan.id)]


@router.post("", response_model=PromotionResponse, status_code=201)
def create_promotion(data: PromotionCreateRequest, artisan=Depends(require_approved_artisan), db: Session = Depends(get_db)):
    return _to_response(PromotionService(db).create(artisan.id, data))