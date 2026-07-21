# app/modules/products/repository.py
from sqlalchemy.orm import Session
from app.modules.products.models import Product


class ProductRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, artisan_id, name: str, description: str | None, price, stock_quantity: int, image_url: str) -> Product:
        product = Product(
            artisan_id=artisan_id,
            name=name,
            description=description,
            price=price,
            stock_quantity=stock_quantity,
            image_url=image_url,
        )
        self.db.add(product)
        self.db.flush()
        return product

    def get_by_id(self, product_id) -> Product | None:
        # No is_active filter — a direct link should still resolve,
        # per the design decision (customer with an old order link).
        return self.db.query(Product).filter(Product.id == product_id).first()

    def list_active(self, skip: int = 0, limit: int = 20) -> list[Product]:
        # Public browsing — only active listings.
        return (
            self.db.query(Product)
            .filter(Product.is_active.is_(True))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def list_by_artisan(self, artisan_id) -> list[Product]:
        # Shop owner's own dashboard — sees everything, including inactive.
        return self.db.query(Product).filter(Product.artisan_id == artisan_id).all()

    def list_active_by_artisan(self, artisan_id) -> list[Product]:
        return (
            self.db.query(Product)
            .filter(Product.artisan_id == artisan_id, Product.is_active.is_(True))
            .all()
        )
        
        # app/modules/products/repository.py — add this method to the existing class
    def get_by_id_for_update(self, product_id) -> Product | None:
        """
        Locking read — SELECT ... FOR UPDATE.
        Used only during checkout, where a read-then-modify (stock decrement)
        must block other concurrent checkouts on the same product row.
        Never use this for normal browsing reads — it would needlessly block
        other requests that only want to view the product.
        """
        return (
            self.db.query(Product)
            .filter(Product.id == product_id)
            .with_for_update()
            .first()
        )
