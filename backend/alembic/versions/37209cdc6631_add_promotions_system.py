"""add promotions system

Revision ID: 37209cdc6631
Revises: eb570aaf0c85
Create Date: 2026-08-20 11:30:46.106612

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '37209cdc6631'
down_revision: Union[str, Sequence[str], None] = 'eb570aaf0c85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CORRECT — matches enum member NAMES, consistent with userrole/orderstatus/paymentstatus:
    discount_type_enum = sa.Enum('PERCENTAGE', 'FIXED', name='discounttype')
    redemption_status_enum = sa.Enum('RESERVED', 'CONFIRMED', 'RELEASED', name='redemptionstatus')

    op.create_table('promotions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('artisan_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('discount_type', discount_type_enum, nullable=False),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('starts_at', sa.DateTime(), nullable=True),
        sa.Column('ends_at', sa.DateTime(), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('times_used', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['artisan_id'], ['artisans.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_promotions_artisan_id', 'promotions', ['artisan_id'])
    op.create_index('ix_promotions_code', 'promotions', ['code'], unique=True)

    op.create_table('promotion_products',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('promotion_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['promotion_id'], ['promotions.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('promotion_id', 'product_id', name='uq_promotion_product'),
    )
    op.create_index('ix_promotion_products_promotion_id', 'promotion_products', ['promotion_id'])
    op.create_index('ix_promotion_products_product_id', 'promotion_products', ['product_id'])

    op.create_table('promotion_redemptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('promotion_id', sa.UUID(), nullable=False),
        sa.Column('checkout_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=True),
        sa.Column('status', redemption_status_enum, nullable=False),
        sa.Column('discount_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['promotion_id'], ['promotions.id']),
        sa.ForeignKeyConstraint(['checkout_id'], ['checkouts.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('checkout_id', name='uq_redemption_per_checkout'),
    )
    op.create_index('ix_promotion_redemptions_promotion_id', 'promotion_redemptions', ['promotion_id'])
    op.create_index('ix_promotion_redemptions_checkout_id', 'promotion_redemptions', ['checkout_id'])
    op.create_index('ix_promotion_redemptions_customer_id', 'promotion_redemptions', ['customer_id'])

    op.add_column('order_items', sa.Column('discounted_unit_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('order_items', sa.Column('promotion_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_order_items_promotion', 'order_items', 'promotions', ['promotion_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_order_items_promotion', 'order_items', type_='foreignkey')
    op.drop_column('order_items', 'promotion_id')
    op.drop_column('order_items', 'discounted_unit_price')
    op.drop_index('ix_promotion_redemptions_customer_id', table_name='promotion_redemptions')
    op.drop_index('ix_promotion_redemptions_checkout_id', table_name='promotion_redemptions')
    op.drop_index('ix_promotion_redemptions_promotion_id', table_name='promotion_redemptions')
    op.drop_table('promotion_redemptions')
    op.drop_index('ix_promotion_products_product_id', table_name='promotion_products')
    op.drop_index('ix_promotion_products_promotion_id', table_name='promotion_products')
    op.drop_table('promotion_products')
    op.drop_index('ix_promotions_code', table_name='promotions')
    op.drop_index('ix_promotions_artisan_id', table_name='promotions')
    op.drop_table('promotions')
    sa.Enum(name='discounttype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='redemptionstatus').drop(op.get_bind(), checkfirst=True)