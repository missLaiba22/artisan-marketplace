import uuid
import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class RedemptionStatus(str, enum.Enum):
    RESERVED = "reserved"
    CONFIRMED = "confirmed"
    RELEASED = "released"


class Promotion(Base):
    __tablename__ = "promotions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artisan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("artisans.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    discount_type: Mapped[DiscountType] = mapped_column(Enum(DiscountType), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Display cache only, updated on confirm — NEVER read for capacity checks.
    times_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    eligible_products: Mapped[list["PromotionProduct"]] = relationship(
        back_populates="promotion", cascade="all, delete-orphan"
    )


class PromotionProduct(Base):
    __tablename__ = "promotion_products"
    __table_args__ = (UniqueConstraint("promotion_id", "product_id", name="uq_promotion_product"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promotion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("promotions.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)

    promotion: Mapped["Promotion"] = relationship(back_populates="eligible_products")


class PromotionRedemption(Base):
    __tablename__ = "promotion_redemptions"
    __table_args__ = (UniqueConstraint("checkout_id", name="uq_redemption_per_checkout"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promotion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("promotions.id"), nullable=False, index=True)
    checkout_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("checkouts.id"), nullable=False, index=True)
    # Nullable, unenforced today — cheap future-proofing per architecture
    # review point 3. A per-customer limit later is a WHERE clause, not a migration.
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[RedemptionStatus] = mapped_column(Enum(RedemptionStatus), default=RedemptionStatus.RESERVED, nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    promotion: Mapped["Promotion"] = relationship()