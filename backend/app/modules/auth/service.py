from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import RegisterRequest, LoginRequest
from app.modules.auth.models import UserRole
from app.modules.artisans.service import ArtisanService
from app.core.security import hash_password, verify_password, create_access_token

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)

    def register(self, data: RegisterRequest):
        # Admin is never self-registerable — it must be created directly
        # (seed script / another admin), never through the public endpoint.
        if data.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin accounts cannot be self-registered",
            )

        if self.repo.get_by_email(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = self.repo.create(
            email=data.email,
            password_hash=hash_password(data.password),
            name=data.name,
            role=data.role,
        )

        if data.role == UserRole.ARTISAN:
            ArtisanService(self.db).create_profile(user_id=user.id, shop_name=data.shop_name)

        self.db.commit()
        self.db.refresh(user)
        return user

    def login(self, data: LoginRequest):
        user = self.repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token = create_access_token({"sub": str(user.id), "role": user.role.value})
        return token