from sqlalchemy.orm import Session
from app.modules.artisans.repository import ArtisanRepository

class ArtisanService:
    def __init__(self, db: Session):
        self.repo = ArtisanRepository(db)

    def create_profile(self, user_id, shop_name: str):
        return self.repo.create(user_id=user_id, shop_name=shop_name)