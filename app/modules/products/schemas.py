# app/modules/products/schemas.py
from pydantic import BaseModel, Field, HttpUrl
from uuid import UUID
from decimal import Decimal
from datetime import datetime


class ProductCreateRequest(BaseModel):
    name: str
    description: str | None = None
    price: Decimal = Field(gt=0)
    stock_quantity: int = Field(ge=0, default=0)
    image_url: HttpUrl


class ProductUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = Field(default=None, gt=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    image_url: HttpUrl | None = None


class ProductResponse(BaseModel):
    id: UUID
    artisan_id: UUID
    name: str
    description: str | None
    price: Decimal
    stock_quantity: int
    image_url: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True