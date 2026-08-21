from groq import AsyncGroq
from app.core.config import settings
from app.modules.chatbot.embedding_service import embed_text
from app.modules.chatbot.repository import EmbeddingRepository

SYSTEM_PROMPT = """You are a shopping assistant for Karigar, a marketplace for handmade Pakistani crafts (pottery, textiles, woodwork, leather goods, crochet).

Answer ONLY using the CONTEXT below — it lists real products and shops currently on the marketplace. Never invent products, prices, or shops not present in the context.

If the CONTEXT has nothing relevant to the question, say so plainly and stop there — do not stretch an unrelated item into an answer. If the question is unrelated to the marketplace (general knowledge, coding help, etc.), politely decline and redirect to shopping questions.

Keep answers to 2-4 sentences unless the user asks for a list."""


class ChatbotService:
    def __init__(self, db):
        self.repo = EmbeddingRepository(db)
        self.client = AsyncGroq(api_key=settings.groq_api_key)

    def _retrieve_context(self, query: str, limit: int = 5) -> str:
        # Sync/blocking: local CPU embedding + a DB query, both short.
        # Fine for V1 — a candidate for threadpool offloading if it
        # ever shows up in the performance-testing pass on the roadmap.
        results = self.repo.search(embed_text(query), limit=limit)
        if not results:
            return "No relevant items found."
        return "\n".join(f"- {r.content}" for r in results)

    async def stream_reply(self, user_message: str, history: list[dict]):
        context = self._retrieve_context(user_message)
        messages = (
            [{"role": "system", "content": SYSTEM_PROMPT}]
            + history
            + [{"role": "user", "content": f"CONTEXT:\n{context}\n\nQUESTION:\n{user_message}"}]
        )
        stream = await self.client.chat.completions.create(
            model="openai/gpt-oss-20b",  # Groq free-tier fast model — check console.groq.com/docs/models if this 404s later
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta