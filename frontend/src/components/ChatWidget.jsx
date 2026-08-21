// src/components/ChatWidget.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import { useChat } from "../hooks/useChat";

// Floating marketplace assistant: grounded (RAG) answers about products and
// artisans, streamed token-by-token over the /ws/chat WebSocket. Rendered once,
// high in the tree, so it rides along on every page.
export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // Read straight from localStorage (same key the axios client uses) rather
  // than threading the raw token through context — the WebSocket needs the JWT
  // string itself, which context deliberately doesn't expose.
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  // The socket only dials once the panel has been opened (`enabled`) and closes
  // with the component — no idle connection for visitors who never chat.
  const { messages, status, error, sendMessage, reconnect } = useChat({
    token,
    enabled: open && Boolean(token),
  });

  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Chat requires a signed-in user (the backend rejects the handshake without a
  // valid JWT). Hide the launcher entirely for signed-out visitors instead of
  // letting them open it and hit an auth error.
  if (!user) return null;

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(draft);
    setDraft("");
  }

  const busy = status === "streaming";
  const canSend = status === "ready" || status === "streaming";

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-maroon text-white shadow-lg shadow-maroon/30 transition-colors hover:bg-crimson"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-2xl">
          {/* Header */}
          <div className="bg-maroon px-4 py-3">
            <p className="font-display text-lg leading-none text-white">
              Karigar Assistant
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-white/70">
              {statusLabel(status)}
            </p>
          </div>

          {/* Transcript */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-parchment px-4 py-4"
          >
            {messages.length === 0 && status !== "error" && (
              <p className="mt-6 text-center text-sm text-ink-soft">
                Ask about products, artisans, or what's in the marketplace.
              </p>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                streaming={
                  busy && i === messages.length - 1 && m.role === "assistant"
                }
              />
            ))}
          </div>

          {/* Auth / connection failures (distinct from a single bad turn, which
              shows inline in the transcript above) */}
          {status === "error" && (
            <p
              className="border-t border-clay/20 bg-clay/5 px-4 py-2 text-xs text-clay"
              role="alert"
            >
              {error || "Connection failed."}
            </p>
          )}

          {status === "closed" && (
            <div className="flex items-center justify-between border-t border-ink/10 bg-parchment-dark px-4 py-2 text-xs text-ink-soft">
              <span>Disconnected.</span>
              <button
                onClick={reconnect}
                className="font-mono uppercase tracking-wide text-brass hover:underline"
              >
                Reconnect
              </button>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-ink/10 bg-white px-3 py-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={canSend ? "Ask a question…" : "Connecting…"}
              disabled={!canSend}
              className="flex-1 rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-brass disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canSend || busy || !draft.trim()}
              className="rounded-md bg-maroon px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-crimson disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function MessageBubble({ role, content, streaming }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-maroon px-3 py-2 text-sm text-white">
          {content}
        </div>
      </div>
    );
  }

  if (role === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-lg border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
          {content}
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg rounded-bl-sm border border-ink/10 bg-white px-3 py-2 text-sm text-ink">
        {content}
        {/* Blinking caret while tokens stream in; a lone ellipsis before the
            first token lands so the bubble isn't empty. */}
        {streaming && content === "" && <span className="text-ink-soft">…</span>}
        {streaming && content !== "" && (
          <span className="ml-0.5 inline-block h-3.5 w-[3px] animate-pulse bg-brass align-middle" />
        )}
      </div>
    </div>
  );
}

function statusLabel(status) {
  switch (status) {
    case "connecting":
      return "Connecting…";
    case "ready":
      return "Online";
    case "streaming":
      return "Typing…";
    case "closed":
      return "Disconnected";
    case "error":
      return "Unavailable";
    default:
      return "";
  }
}

function ChatIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}