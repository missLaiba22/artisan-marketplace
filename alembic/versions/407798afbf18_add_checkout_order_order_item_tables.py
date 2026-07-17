"""add checkout, order, order_item tables

Revision ID: 407798afbf18
Revises: 7b6e1b40b25c
Create Date: 2026-07-17 01:54:58.541144

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '407798afbf18'
down_revision: Union[str, Sequence[str], None] = '7b6e1b40b25c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('checkouts',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('customer_id', sa.UUID(), nullable=False),
    sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('payment_status', sa.Enum('PENDING', 'PAID', 'FAILED', name='paymentstatus'), nullable=False),
    sa.Column('payment_reference', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_checkouts_customer_id'), 'checkouts', ['customer_id'], unique=False)
    op.create_table('order_items',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('product_name', sa.String(), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_items_order_id'), 'order_items', ['order_id'], unique=False)

    op.add_column('orders', sa.Column('checkout_id', sa.UUID(), nullable=False))
    op.add_column('orders', sa.Column('artisan_id', sa.UUID(), nullable=False))

    # --- FIX: explicitly create the enum type before adding a column that uses it ---
    orderstatus_enum = postgresql.ENUM('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED', name='orderstatus')
    orderstatus_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('orders', sa.Column('status', orderstatus_enum, nullable=False))
    # --- end fix ---

    op.add_column('orders', sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False))
    op.create_index(op.f('ix_orders_artisan_id'), 'orders', ['artisan_id'], unique=False)
    op.create_index(op.f('ix_orders_checkout_id'), 'orders', ['checkout_id'], unique=False)
    op.create_foreign_key(None, 'orders', 'artisans', ['artisan_id'], ['id'])
    op.create_foreign_key(None, 'orders', 'checkouts', ['checkout_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'orders', type_='foreignkey')
    op.drop_constraint(None, 'orders', type_='foreignkey')
    op.drop_index(op.f('ix_orders_checkout_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_artisan_id'), table_name='orders')
    op.drop_column('orders', 'created_at')
    op.drop_column('orders', 'status')
    op.drop_column('orders', 'artisan_id')
    op.drop_column('orders', 'checkout_id')
    op.drop_index(op.f('ix_order_items_order_id'), table_name='order_items')
    op.drop_table('order_items')
    op.drop_index(op.f('ix_checkouts_customer_id'), table_name='checkouts')
    op.drop_table('checkouts')

    # clean up the enum type on downgrade too
    postgresql.ENUM(name='orderstatus').drop(op.get_bind(), checkfirst=True)