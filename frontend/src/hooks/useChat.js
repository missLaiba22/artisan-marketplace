// src/hooks/useChat.js
import { useCallback, useEffect, useRef, useState } from "react";
import { createChatSocket } from "../api/chatSocket";

// Everything stateful about a chat session — connection lifecycle, assembly of
// streamed tokens, and the message list — lives here so ChatWidget stays purely
// presentational.
//
// `enabled` lets the caller defer the socket until the panel is actually opened:
// there's no reason to hold an open WebSocket for someone who never clicks the
// bubble. Flipping it back on (or calling reconnect) re-runs the effect and
// dials a fresh connection.
export function useChat({ token, enabled }) {
  const [messages, setMessages] = useState([]); // { role: "user"|"assistant"|"error", content }
  const [status, setStatus] = useState("idle"); // idle | connecting | ready | streaming | error | closed
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0); // bump to force a reconnect

  const socketRef = useRef(null);
  // Whether an assistant turn is mid-stream. Kept in a ref (not state) because
  // token frames arrive faster than React re-renders settle — onToken reads it
  // synchronously to decide whether to append.
  const streamingRef = useRef(false);

  // When the signed-in account changes, the token changes with it — wipe the
  // transcript so one user never sees another's messages. The backend already
  // isolates each connection by the token in the handshake and keeps history
  // per-connection; this just keeps the frontend view honest with that. A new
  // account (or a switch back) always starts from an empty conversation.
  useEffect(() => {
    setMessages([]);
    setError(null);
    streamingRef.current = false;
  }, [token]);

  useEffect(() => {
    if (!enabled || !token) return;

    setStatus("connecting");
    setError(null);

    const socket = createChatSocket({
      token,
      onAuthOk: () => setStatus("ready"),

      onToken: (chunk) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          // Append onto the placeholder assistant message that sendMessage
          // pushed when the turn started.
          if (streamingRef.current && last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      },

      onDone: () => {
        streamingRef.current = false;
        setStatus("ready");
      },

      onError: (detail) => {
        // A failed turn doesn't kill the socket (the backend keeps it open), so
        // we stay "ready" and just surface the error in the transcript.
        streamingRef.current = false;
        setStatus("ready");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            next[next.length - 1] = { role: "error", content: detail };
          } else {
            next.push({ role: "error", content: detail });
          }
          return next;
        });
      },

      onClose: ({ authFailed, reason }) => {
        streamingRef.current = false;
        if (authFailed) {
          setStatus("error");
          setError(reason || "Authentication failed.");
        } else {
          setStatus("closed");
        }
      },
    });

    socketRef.current = socket;
    return () => socket.close();
  }, [enabled, token, attempt]);

  const sendMessage = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed || streamingRef.current) return;

    const sent = socketRef.current?.send(trimmed);
    if (!sent) return; // socket not open/authed yet — composer should be disabled anyway

    streamingRef.current = true;
    setStatus("streaming");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" }, // placeholder the streamed tokens fill in
    ]);
  }, []);

  const reconnect = useCallback(() => setAttempt((a) => a + 1), []);

  return { messages, status, error, sendMessage, reconnect };
}