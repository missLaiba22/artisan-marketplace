# app/modules/artisans/repository.py
from sqlalchemy.orm import Session
from app.modules.artisans.models import Artisan

class ArtisanRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id, shop_name: str) -> Artisan:
        artisan = Artisan(user_id=user_id, shop_name=shop_name, is_approved=False)
        self.db.add(artisan)
        self.db.flush()
        return artisan

    def get_by_user_id(self, user_id) -> Artisan | None:
        return self.db.query(Artisan).filter(Artisan.user_id == user_id).first()

    def get_by_id(self, artisan_id) -> Artisan | None:
        return self.db.query(Artisan).filter(Artisan.id == artisan_id).first()

    def list_pending(self) -> list[Artisan]:
        return self.db.query(Artisan).filter(Artisan.is_approved.is_(False)).all()