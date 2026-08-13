# app/modules/auth/oauth_repository.py
from sqlalchemy.orm import Session
from app.modules.auth.oauth_models import OAuthAccount


class OAuthAccountRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_provider_id(self, provider: str, provider_user_id: str) -> OAuthAccount | None:
        return (
            self.db.query(OAuthAccount)
            .filter(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_user_id == provider_user_id,
            )
            .first()
        )

    def create(self, user_id, provider: str, provider_user_id: str) -> OAuthAccount:
        account = OAuthAccount(user_id=user_id, provider=provider, provider_user_id=provider_user_id)
        self.db.add(account)
        self.db.flush()
        return account