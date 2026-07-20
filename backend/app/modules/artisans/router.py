# app/modules/artisans/router.py
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import UserRole
from app.modules.artisans.schemas import ArtisanProfileResponse, ArtisanUpdateRequest
from app.modules.artisans.service import ArtisanService
from app.modules.products.schemas import ProductResponse

router = APIRouter(prefix="/artisans", tags=["artisans"])


@router.get("", response_model=list[ArtisanProfileResponse])
def list_artisans(
    db: Session = Depends(get_db),
):
    return ArtisanService(db).list_approved()


@router.get("/{artisan_id}", response_model=ArtisanProfileResponse)
def get_artisan(
    artisan_id: UUID,
    db: Session = Depends(get_db),
):
    return ArtisanService(db).get_public_profile(artisan_id)


@router.get("/{artisan_id}/products", response_model=list[ProductResponse])
def list_artisan_products(
    artisan_id: UUID,
    db: Session = Depends(get_db),
):
    return ArtisanService(db).list_products(artisan_id)

@router.get("/me", response_model=ArtisanProfileResponse)
def get_my_profile(
    current_user = Depends(require_role(UserRole.ARTISAN)),
    db: Session = Depends(get_db),
):
    return ArtisanService(db).get_my_profile(current_user.id)

@router.patch("/me", response_model=ArtisanProfileResponse)
def update_my_profile(
    data: ArtisanUpdateRequest,
    current_user = Depends(require_role(UserRole.ARTISAN)),
    db: Session = Depends(get_db),
):
    return ArtisanService(db).update_shop_name(current_user.id, data.shop_name)

@router.get("/pending", response_model=list[ArtisanProfileResponse])
def list_pending_artisans(
    current_user = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return ArtisanService(db).list_pending()

@router.patch("/{artisan_id}/approve", response_model=ArtisanProfileResponse)
def approve_artisan(
    artisan_id: UUID,
    current_user = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return ArtisanService(db).approve(artisan_id)