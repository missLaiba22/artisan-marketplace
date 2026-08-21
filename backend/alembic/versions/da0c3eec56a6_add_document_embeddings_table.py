"""add document embeddings table

Revision ID: da0c3eec56a6
Revises: 37209cdc6631
Create Date: 2026-08-21 11:36:02.356987

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'da0c3eec56a6'
down_revision: Union[str, Sequence[str], None] = '37209cdc6631'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    source_type_enum = sa.Enum("PRODUCT", "ARTISAN", name="sourcetype")

    op.create_table(
        "document_embeddings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_type", source_type_enum, nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(384), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_embeddings_source_type", "document_embeddings", ["source_type"])
    op.create_index("ix_document_embeddings_source_id", "document_embeddings", ["source_id"])


def downgrade() -> None:
    op.drop_index("ix_document_embeddings_source_id", table_name="document_embeddings")
    op.drop_index("ix_document_embeddings_source_type", table_name="document_embeddings")
    op.drop_table("document_embeddings")
    sa.Enum(name="sourcetype").drop(op.get_bind(), checkfirst=True)