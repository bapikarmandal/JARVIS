"""Connects streamed AI output to sentence-level speech without blocking microphone capture."""

import asyncio
import re
from collections.abc import Callable

from jarvis.ai.service import ChatService
from jarvis.voice.tts import TTSManager


class ConversationManager:
    """Streams one model reply and queues each completed sentence for natural speech."""

    def __init__(self, chat: ChatService, tts: TTSManager) -> None:
        self.chat = chat
        self.tts = tts
        self._task: asyncio.Task[None] | None = None

    @property
    def is_responding(self) -> bool:
        return self._task is not None and not self._task.done()

    async def respond(
        self,
        conversation_id: int,
        transcript: str,
        on_chunk: Callable[[str], None],
        on_speaking: Callable[[], None],
        on_complete: Callable[[], None],
    ) -> None:
        await self.cancel()
        self._task = asyncio.create_task(
            self._stream_response(
                conversation_id,
                transcript,
                on_chunk,
                on_speaking,
                on_complete,
            ),
            name="jarvis-voice-response",
        )

    async def cancel(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        await self.tts.interrupt()

    async def _stream_response(
        self,
        conversation_id: int,
        transcript: str,
        on_chunk: Callable[[str], None],
        on_speaking: Callable[[], None],
        on_complete: Callable[[], None],
    ) -> None:
        sentence_buffer = ""
        async for chunk in self.chat.stream_reply(conversation_id, transcript):
            on_chunk(chunk)
            sentence_buffer += chunk
            sentences, sentence_buffer = self._take_sentences(sentence_buffer)
            for sentence in sentences:
                on_speaking()
                await self.tts.enqueue(sentence)
        if sentence_buffer.strip():
            on_speaking()
            await self.tts.enqueue(sentence_buffer)
        await self.tts.wait_until_idle()
        on_complete()

    @staticmethod
    def _take_sentences(text: str) -> tuple[list[str], str]:
        parts = re.split(r"(?<=[.!?])\s+", text)
        if len(parts) == 1:
            return [], text
        return [part.strip() for part in parts[:-1] if part.strip()], parts[-1]
