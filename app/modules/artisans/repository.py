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