# app/modules/artisans/service.py
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.modules.artisans.repository import ArtisanRepository
from app.modules.products.repository import ProductRepository

class ArtisanService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ArtisanRepository(db)

    def create_profile(self, user_id, shop_name: str):
        # called from AuthService — no commit here, AuthService owns the transaction
        return self.repo.create(user_id=user_id, shop_name=shop_name)

    def get_my_profile(self, user_id):
        artisan = self.repo.get_by_user_id(user_id)
        if artisan is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Artisan profile not found")
        return artisan

    def get_public_profile(self, artisan_id):
        artisan = self.repo.get_public_by_id(artisan_id)
        if artisan is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Artisan not found")
        return artisan

    def list_approved(self):
        return self.repo.list_approved()

    def list_products(self, artisan_id):
        return ProductRepository(self.db).list_by_artisan(artisan_id)

    def update_shop_name(self, user_id, shop_name: str):
        artisan = self.get_my_profile(user_id)
        artisan.shop_name = shop_name
        self.db.commit()
        self.db.refresh(artisan)
        return artisan

    def list_pending(self):
        return self.repo.list_pending()

    def approve(self, artisan_id):
        artisan = self.repo.get_by_id(artisan_id)
        if artisan is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Artisan not found")
        artisan.is_approved = True
        self.db.commit()
        self.db.refresh(artisan)
        return artisan