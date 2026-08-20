from pydantic import BaseModel, Field, model_validator
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from app.modules.promotions.models import DiscountType


class PromotionCreateRequest(BaseModel):
    code: str = Field(min_length=3, max_length=32)
    discount_type: DiscountType
    discount_value: Decimal = Field(gt=0)
    product_ids: list[UUID] = Field(min_length=1)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_uses: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_percentage_range(self):
        if self.discount_type == DiscountType.PERCENTAGE and self.discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100")
        return self

    @model_validator(mode="after")
    def validate_date_window(self):
        if self.starts_at and self.ends_at and self.starts_at >= self.ends_at:
            raise ValueError("starts_at must be before ends_at")
        return self


class PromotionResponse(BaseModel):
    id: UUID
    artisan_id: UUID
    code: str
    discount_type: DiscountType
    discount_value: Decimal
    starts_at: datetime | None
    ends_at: datetime | None
    max_uses: int | None
    times_used: int
    is_active: bool
    created_at: datetime
    product_ids: list[UUID]