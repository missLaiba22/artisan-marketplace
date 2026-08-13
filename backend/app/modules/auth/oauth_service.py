# app/modules/auth/oauth_service.py
from sqlalchemy.orm import Session
from app.modules.auth.repository import UserRepository
from app.modules.auth.oauth_repository import OAuthAccountRepository
from app.modules.auth.models import UserRole
from app.modules.artisans.repository import ArtisanRepository
from app.core.security import create_access_token


class OAuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.oauth_repo = OAuthAccountRepository(db)
        self.artisan_repo = ArtisanRepository(db)

    def login_or_register(
        self,
        provider: str,
        provider_user_id: str,
        email: str,
        name: str | None,
        intent: str = "customer",
    ):
        """
        Returns (access_token, user, needs_onboarding).

        needs_onboarding=True means: this is a brand-new artisan account with
        no shop profile yet — the caller (router) should redirect to a
        profile-completion step instead of straight into the app.

        Three-step resolution, in order — each step is checked ONLY if the
        previous one didn't resolve:

        1. Known Google identity -> that user, as-is. `intent` is irrelevant
           here; this person already has an established role.
        2. Existing local account, same email -> link, don't duplicate.
           `intent` is STILL irrelevant — an existing account's role is
           authoritative and is never changed by which button someone
           clicked. This is a deliberate security boundary: a customer
           can't upgrade themselves to artisan just by re-authenticating
           with an "artisan" intent. Becoming an artisan for an existing
           account remains a separate, explicit action.
        3. Neither exists -> brand new user. THIS is the only branch where
           `intent` matters, because there's no existing role to protect.
        """
        # --- Step 1: known Google identity ---
        oauth_account = self.oauth_repo.get_by_provider_id(provider, provider_user_id)
        if oauth_account is not None:
            user = self.user_repo.get_by_id(oauth_account.user_id)
            return self._issue_token(user) + (False,)

        # --- Step 2: existing local account, same email -> link ---
        user = self.user_repo.get_by_email(email)
        if user is not None:
            self.oauth_repo.create(user_id=user.id, provider=provider, provider_user_id=provider_user_id)
            self.db.commit()
            # Defensive check, not the expected path: a local artisan
            # account should already have a profile (created atomically at
            # /auth/register time). If one somehow doesn't exist, still
            # route them to complete it rather than dropping them into a
            # dashboard that will just 404.
            needs_onboarding = (
                user.role == UserRole.ARTISAN
                and self.artisan_repo.get_by_user_id(user.id) is None
            )
            return self._issue_token(user) + (needs_onboarding,)

        # --- Step 3: brand new user ---
        role = UserRole.ARTISAN if intent == "artisan" else UserRole.CUSTOMER
        user = self.user_repo.create(
            email=email,
            name=name,
            role=role,
            password_hash=None,
        )
        self.oauth_repo.create(user_id=user.id, provider=provider, provider_user_id=provider_user_id)
        self.db.commit()
        self.db.refresh(user)

        # Artisan profile (shop_name etc.) is deliberately NOT created here —
        # Google never supplies it. A new artisan always needs onboarding;
        # a new customer never does.
        needs_onboarding = role == UserRole.ARTISAN
        return self._issue_token(user) + (needs_onboarding,)

    def _issue_token(self, user):
        token = create_access_token({"sub": str(user.id), "role": user.role.value})
        return token, user