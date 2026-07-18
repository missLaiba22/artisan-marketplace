# app/modules/orders/router.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import UserRole
from app.modules.artisans.dependencies import require_approved_artisan
from app.modules.orders.schemas import CheckoutRequest, CheckoutResponse, OrderResponse
from app.modules.orders.service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/checkout", response_model=CheckoutResponse, status_code=201)
def checkout(
    data: CheckoutRequest,
    current_user=Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
):
    return OrderService(db).create_order(current_user.id, data)


@router.get("/me/artisan-orders", response_model=list[OrderResponse])
def list_my_artisan_orders(
    artisan=Depends(require_approved_artisan),
    db: Session = Depends(get_db),
):
    return OrderService(db).list_orders_for_artisan(artisan.id)