# app/modules/auth/oauth_router.py
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.auth.oauth_service import OAuthService

router = APIRouter(prefix="/auth/google", tags=["auth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/login")
async def google_login(request: Request, intent: str = "customer"):
    # `intent` only ever matters for brand-new signups (see OAuthService) —
    # an existing account's role can't be changed by this. Validated against
    # a fixed set rather than trusted as free text, since it flows into a
    # role assignment downstream.
    if intent not in ("customer", "artisan"):
        intent = "customer"

    # Stashed in the same session cookie Authlib already uses to store the
    # CSRF `state` value — it needs to survive the round-trip through
    # Google's consent screen and back, and this is the one piece of
    # storage already wired up for exactly that purpose. No new
    # infrastructure needed for one extra string.
    request.session["oauth_intent"] = intent

    return await oauth.google.authorize_redirect(request, settings.google_redirect_uri)


@router.get("/callback")
async def google_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")

    # .pop(), not .get() — this value is single-use, consumed the moment
    # this callback runs. Leaving it in the session could otherwise leak
    # into an unrelated later request during the same browser session.
    intent = request.session.pop("oauth_intent", "customer")

    db = SessionLocal()
    try:
        access_token, user, needs_onboarding = OAuthService(db).login_or_register(
            provider="google",
            provider_user_id=userinfo["sub"],
            email=userinfo["email"],
            name=userinfo.get("name"),
            intent=intent,
        )
    finally:
        db.close()

    # Two possible destinations, decided here (backend), not guessed
    # client-side: a brand-new artisan has no shop profile yet and must
    # complete onboarding before anything else; everyone else goes through
    # the normal callback straight into the app.
    destination = "complete-artisan-profile" if needs_onboarding else "oauth-callback"

    # Fragment (#), not query param (?) — never sent to any server on
    # subsequent requests, never appears in access logs.
    return RedirectResponse(f"{settings.frontend_url}/{destination}#access_token={access_token}")