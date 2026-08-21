import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.modules.auth.repository import UserRepository
from app.modules.chatbot.service import ChatbotService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["chatbot"])

MAX_HISTORY_TURNS = 6  # trims oldest turns — bounds token usage without real summarization


@router.websocket("/chat")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()

    # --- First-message auth handshake ---
    try:
        raw = await websocket.receive_text()
    except WebSocketDisconnect:
        return  # client vanished before sending anything — nothing to clean up

    try:
        token = json.loads(raw).get("token")
    except json.JSONDecodeError:
        await websocket.close(code=4001, reason="Malformed auth message")
        return

    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_access_token(token)
    if payload is None:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # Own session for this connection's whole lifetime — not the
    # request-scoped get_db(), since a WebSocket isn't one request/response.
    db = SessionLocal()
    user = UserRepository(db).get_by_id(payload.get("sub"))
    if user is None:
        await websocket.close(code=4001, reason="User not found")
        db.close()
        return

    await websocket.send_json({"type": "auth_ok"})

    service = ChatbotService(db)
    history: list[dict] = []  # ephemeral — lives only as long as this connection

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                user_message = json.loads(raw)["message"]
            except (json.JSONDecodeError, KeyError, TypeError):
                await websocket.send_json({"type": "error", "detail": 'Expected {"message": "..."}'})
                continue

            if not user_message.strip():
                continue

            try:
                full_reply = ""
                async for token_chunk in service.stream_reply(user_message, history):
                    full_reply += token_chunk
                    await websocket.send_json({"type": "token", "content": token_chunk})
                await websocket.send_json({"type": "done"})
            except Exception:
                # One bad turn (e.g. Groq rate-limited) shouldn't kill the
                # whole connection — log it, tell the client, keep chatting.
                logger.exception("Chat generation failed for user %s", user.id)
                await websocket.send_json({"type": "error", "detail": "Something went wrong generating a reply."})
                continue

            history.append({"role": "user", "content": user_message})
            history.append({"role": "assistant", "content": full_reply})
            history = history[-(MAX_HISTORY_TURNS * 2):]

    except WebSocketDisconnect:
        logger.info("Chat websocket disconnected for user %s", user.id)
    finally:
        db.close()