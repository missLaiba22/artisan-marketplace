# app/modules/auth/oauth_models.py
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        # A given provider identity (e.g. this exact Google account) can only
        # ever be linked to ONE of our users. Prevents the same Google
        # account being attached to two different local accounts.
        UniqueConstraint("provider", "provider_user_id", name="uq_provider_identity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)          # "google"
    provider_user_id: Mapped[str] = mapped_column(String, nullable=False)  # Google's "sub" claim
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())