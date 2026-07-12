import email

from sqlalchemy.orm import Session
from app.modules.auth.models import User

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def create(self, email: str, password_hash: str, name: str | None, role) -> User:
        user = User(email=email, password_hash=password_hash, name=name, role=role)
        self.db.add(user)
        self.db.flush()
        return user