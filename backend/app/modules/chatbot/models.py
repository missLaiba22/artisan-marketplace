import uuid
import enum
from datetime import datetime
from sqlalchemy import Text, Enum, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.core.database import Base


class SourceType(str, enum.Enum):
    PRODUCT = "product"
    ARTISAN = "artisan"


class DocumentEmbedding(Base):
    __tablename__ = "document_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # No FK — polymorphic pointer into either products.id or artisans.id.
    # Deliberate trade-off: one shared table over two near-duplicate ones,
    # at the cost of DB-enforced referential integrity here.
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False, index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # the raw text that was embedded
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)  # 384 = MiniLM's output dim
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())