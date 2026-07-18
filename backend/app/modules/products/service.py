# app/modules/products/service.py
from itertools import product

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.modules.products.repository import ProductRepository
from app.modules.products.schemas import ProductCreateRequest, ProductUpdateRequest


class ProductService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ProductRepository(db)

    def create_product(self, artisan_id, data: ProductCreateRequest):
        product = self.repo.create(
            artisan_id=artisan_id,
            name=data.name,
            description=data.description,
            price=data.price,
            stock_quantity=data.stock_quantity,
            image_url=str(data.image_url),
        )
        self.db.commit()
        self.db.refresh(product)
        return product

    def get_product(self, product_id):
        product = self.repo.get_by_id(product_id)
        if product is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
        return product

    def list_products(self, skip: int = 0, limit: int = 20):
        return self.repo.list_active(skip=skip, limit=limit)

    def list_my_products(self, artisan_id):
        return self.repo.list_by_artisan(artisan_id)

    def _get_owned_product(self, product_id, artisan_id):
        """Shared by update/delete: fetch + ownership check, in one place."""
        product = self.get_product(product_id)  # 404 if it doesn't exist at all
        if product.artisan_id != artisan_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not own this product")
        return product

    def update_product(self, product_id, artisan_id, data: ProductUpdateRequest):
        product = self._get_owned_product(product_id, artisan_id)

        # Only touch fields the client actually sent — this is the partial-update
        # pattern: exclude_unset=True gives us just what was provided.
        updates = data.model_dump(exclude_unset=True)
        if "image_url" in updates:
            updates["image_url"] = str(updates["image_url"])
        for field, value in updates.items():
            setattr(product, field, value)

        self.db.commit()
        self.db.refresh(product)
        return product

    def delete_product(self, product_id, artisan_id):
        product = self._get_owned_product(product_id, artisan_id)
        product.is_active = False   # soft delete — never repo-level hard delete
        self.db.commit()
        self.db.refresh(product)
        return product
    def restore_product(self, product_id, artisan_id):
        product = self._get_owned_product(product_id, artisan_id)
        product.is_active = True
        self.db.commit()
        self.db.refresh(product)
        return product