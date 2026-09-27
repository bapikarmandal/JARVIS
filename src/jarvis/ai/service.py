"""Chat orchestration with bounded context and explicit persistent memory injection."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime

from jarvis.ai.providers import make_provider
from jarvis.core.models import ChatMessage, MessageRole, ModelProfile
from jarvis.memory.service import MemoryService
from jarvis.storage.database import Database
from jarvis.storage.secrets import SecretStore


class ChatService:
    """Combines recent conversation and relevant opt-in memories for model calls."""

    SYSTEM_PROMPT = (
        "You are JARVIS, a capable, concise, safety-conscious desktop assistant. "
        "Never claim to have completed a system action unless a capability explicitly confirms it."
    )

    def __init__(self, database: Database, memories: MemoryService, secrets: SecretStore) -> None:
        self.database, self.memories, self.secrets = database, memories, secrets

    def profile(self) -> ModelProfile:
        from jarvis.core.models import ProviderKind

        return ModelProfile(
            provider=ProviderKind(self.database.get_setting("provider", "ollama")),
            model=self.database.get_setting("model", "llama3.2"),
            base_url=self.database.get_setting("base_url", "http://127.0.0.1:11434"),
        )

    async def reply(self, conversation_id: int, user_text: str) -> str:
        return "".join([chunk async for chunk in self.stream_reply(conversation_id, user_text)])

    async def stream_reply(self, conversation_id: int, user_text: str) -> AsyncIterator[str]:
        """Persist a response while yielding provider chunks as they arrive."""
        now = datetime.now(UTC)
        if self.database.message_count(conversation_id) == 0:
            self.database.set_conversation_title(
                conversation_id, user_text.strip() or "New conversation"
            )
        user_message = ChatMessage(MessageRole.USER, user_text.strip(), now)
        self.database.add_message(conversation_id, user_message)
        recalled = self.memories.search(user_text)[:5]
        memory_context = "\n".join(f"- {memory.content}" for memory in recalled)
        system_content = self.SYSTEM_PROMPT
        if memory_context:
            system_content += f"\nRelevant user-approved memories:\n{memory_context}"
        messages = [ChatMessage(MessageRole.SYSTEM, system_content, now)]
        messages.extend(self.database.messages(conversation_id, limit=24))
        profile = self.profile()
        provider = make_provider(profile, self.secrets.get(f"provider:{profile.provider.value}"))
        response_parts: list[str] = []
        async for chunk in provider.stream(messages):
            response_parts.append(chunk)
            yield chunk
        response = "".join(response_parts).strip()
        if not response:
            response = "The selected model returned an empty response."
        self.database.add_message(
            conversation_id, ChatMessage(MessageRole.ASSISTANT, response, datetime.now(UTC))
        )
        self.database.log(
            "ai", "info", f"Completed request through {profile.provider.value}/{profile.model}."
        )
        return response
