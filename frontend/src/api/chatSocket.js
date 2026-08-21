// src/api/chatSocket.js
//
// Thin transport layer over the backend's /ws/chat WebSocket. It keeps the raw
// wire protocol — the first-message auth handshake and the {type: ...} frames —
// in one place, the same way client.js is the single home for REST token
// attachment. The React layer (useChat) never touches JSON framing or ready
// states; it only ever sees decoded callbacks.
//
// Wire protocol (mirrors backend/app/modules/chatbot/router.py):
//   client → { token }                     first frame, sent immediately on open
//   server → { type: "auth_ok" }           handshake accepted
//   client → { message }                   one user turn
//   server → { type: "token", content }    streamed, many frames per turn
//   server → { type: "done" }              turn complete
//   server → { type: "error", detail }     one turn failed — socket stays open
//   auth failure → server closes with code 4001 + reason string (no error frame)

const API_URL = import.meta.env.VITE_API_URL;

// The custom close code the backend uses for every auth-handshake rejection
// (missing / malformed / invalid token, or unknown user).
export const AUTH_CLOSE_CODE = 4001;

// http://host:8000 → ws://host:8000/ws/chat ; https → wss. Derived from the
// same env var the REST client reads, so the backend is pointed at in exactly
// one place across the whole frontend.
function toWsUrl(httpUrl) {
  return httpUrl.replace(/^http/, "ws") + "/ws/chat";
}

export function createChatSocket({ token, onAuthOk, onToken, onDone, onError, onClose }) {
  const ws = new WebSocket(toWsUrl(API_URL));
  let authed = false;

  ws.addEventListener("open", () => {
    // Token rides in the first frame, never in the URL — the same rule the rest
    // of the project follows (tokens never land in query strings or logs).
    ws.send(JSON.stringify({ token }));
  });

  ws.addEventListener("message", (event) => {
    let frame;
    try {
      frame = JSON.parse(event.data);
    } catch {
      return; // backend only ever sends JSON — ignore anything else
    }

    switch (frame.type) {
      case "auth_ok":
        authed = true;
        onAuthOk?.();
        break;
      case "token":
        onToken?.(frame.content);
        break;
      case "done":
        onDone?.();
        break;
      case "error":
        onError?.(frame.detail);
        break;
      default:
        break;
    }
  });

  ws.addEventListener("close", (event) => {
    // A 4001 close before we ever authed is the handshake being rejected. Pass
    // the reason string the backend attached so the UI can distinguish
    // "auth failed" from an ordinary network drop.
    onClose?.({
      code: event.code,
      reason: event.reason,
      authFailed: !authed && event.code === AUTH_CLOSE_CODE,
    });
  });

  return {
    // Returns false when the socket isn't open/authed yet — the hook uses this
    // to keep the composer disabled until the handshake has completed.
    send(message) {
      if (ws.readyState !== WebSocket.OPEN || !authed) return false;
      ws.send(JSON.stringify({ message }));
      return true;
    },
    close() {
      ws.close();
    },
  };
}