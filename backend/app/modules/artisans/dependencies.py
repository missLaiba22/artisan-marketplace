# app/modules/artisans/dependencies.py
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import UserRole
from app.modules.artisans.repository import ArtisanRepository


def require_approved_artisan(
    current_user = Depends(require_role(UserRole.ARTISAN)),
    db: Session = Depends(get_db),
):
    """
    Business-rule authorization: not just 'are you an artisan' (require_role
    already guarantees that) but 'are you an APPROVED artisan'.
    Queried fresh from DB every request — approval status is never in the JWT.
    """
    artisan = ArtisanRepository(db).get_by_user_id(current_user.id)
    if artisan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artisan profile not found",
        )
    if not artisan.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your artisan account is pending approval",
        )
    return artisan