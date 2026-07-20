# app/modules/orders/router.py
from fastapi import APIRouter, Depends, HTTPException, status
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


@router.get("/me/history", response_model=list[CheckoutResponse])
def list_my_order_history(
    current_user=Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
):
    return OrderService(db).list_checkouts_for_customer(current_user.id)


@router.get("/me/latest", response_model=CheckoutResponse)
def get_my_latest_order(
    current_user=Depends(require_role(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
):
    checkout = OrderService(db).get_latest_checkout_for_customer(current_user.id)
    if checkout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No order history found")
    return checkout