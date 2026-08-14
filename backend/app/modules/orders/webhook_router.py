import stripe
from fastapi import APIRouter, Request, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.modules.orders.service import OrderService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")

    service = OrderService(db)
    session = event["data"]["object"]

    if event["type"] == "checkout.session.completed":
        service.mark_checkout_paid(session["id"])
    elif event["type"] == "checkout.session.expired":
        service.mark_checkout_expired(session["id"])
    # Any other event type: acknowledge, don't act. Stripe sends every
    # event type your account is subscribed to — always 200 so it doesn't
    # retry events this app deliberately ignores.

    return {"status": "received"}