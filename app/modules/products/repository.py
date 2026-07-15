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