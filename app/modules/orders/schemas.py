# app/modules/orders/schemas.py
from pydantic import BaseModel, Field
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from app.modules.orders.models import PaymentStatus, OrderStatus


class CheckoutItemRequest(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)


class CheckoutRequest(BaseModel):
    items: list[CheckoutItemRequest] = Field(min_length=1)


class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    unit_price: Decimal
    quantity: int

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: UUID
    checkout_id: UUID
    artisan_id: UUID
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemResponse]

    class Config:
        from_attributes = True


class CheckoutResponse(BaseModel):
    id: UUID
    customer_id: UUID
    total_amount: Decimal
    payment_status: PaymentStatus
    payment_reference: str | None
    created_at: datetime
    orders: list[OrderResponse]

    class Config:
        from_attributes = True