"""add payment expired status and stripe session id

Revision ID: eb570aaf0c85
Revises: 4837c34c8174
Create Date: 2026-08-15 01:28:09.549192

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eb570aaf0c85'
down_revision: Union[str, Sequence[str], None] = '4837c34c8174'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('checkouts', sa.Column('stripe_session_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_checkouts_stripe_session_id'), 'checkouts', ['stripe_session_id'], unique=True)

    # Postgres can't detect changes to enum VALUES via autogenerate — only
    # table/column structure. Adding 'EXPIRED' to the existing paymentstatus
    # enum has to be written by hand.
    op.execute("ALTER TYPE paymentstatus ADD VALUE 'EXPIRED'")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_checkouts_stripe_session_id'), table_name='checkouts')
    op.drop_column('checkouts', 'stripe_session_id')

    # Postgres has no ALTER TYPE ... DROP VALUE — an enum value, once added,
    # cannot be removed. Downgrade cannot undo the ADD VALUE above; this is
    # a structural limitation, not an oversight.
