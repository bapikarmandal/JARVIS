"""Runtime owner for continuous, interruptible, full-duplex voice conversation."""

import asyncio
import logging
import threading
from collections.abc import Callable
from concurrent.futures import Future

from jarvis.ai.service import ChatService
from jarvis.storage.database import Database
from jarvis.voice.conversation import ConversationManager
from jarvis.voice.models import VoiceEvent, VoiceEventKind, VoiceSettings, VoiceStatus
from jarvis.voice.stt import STTManager
from jarvis.voice.tts import TTSManager


class VoiceManager:
    """Runs all voice work on a dedicated asyncio loop and emits framework-neutral events."""

    def __init__(self, chat: ChatService, database: Database) -> None:
        self.database = database
        self.settings = self._load_settings()
        self.stt = STTManager(self.settings)
        self.tts = TTSManager(self.settings)
        self.conversation = ConversationManager(chat, self.tts)
        self._logger = logging.getLogger("jarvis.voice")
        self._listeners: list[Callable[[VoiceEvent], None]] = []
        self._listeners_lock = threading.Lock()
        self._loop = asyncio.new_event_loop()
        self._ready = threading.Event()
        self._thread = threading.Thread(
            target=self._run_loop,
            daemon=True,
            name="jarvis-voice-loop",
        )
        self._thread.start()
        self._ready.wait(timeout=3)
        self._active = False
        self._conversation_id: int | None = None
        self._microphone_task: asyncio.Task[None] | None = None
        self._status = VoiceStatus.IDLE

    @property
    def status(self) -> VoiceStatus:
        return self._status

    def subscribe(self, listener: Callable[[VoiceEvent], None]) -> None:
        with self._listeners_lock:
            self._listeners.append(listener)

    def set_conversation_id(self, conversation_id: int) -> None:
        self._conversation_id = conversation_id

    def toggle(self) -> Future[None]:
        return self.submit(self.stop() if self._active else self.start())

    def submit(self, coroutine: object) -> Future[None]:
        return asyncio.run_coroutine_threadsafe(coroutine, self._loop)  # type: ignore[arg-type]

    async def start(self) -> None:
        if self._active:
            return
        if self._conversation_id is None:
            raise RuntimeError("Open a chat conversation before enabling voice mode.")
        self._active = True
        await self.tts.start()
        self._set_status(VoiceStatus.LISTENING)
        self._microphone_task = asyncio.create_task(
            self._microphone_loop(), name="jarvis-continuous-microphone"
        )

    async def stop(self) -> None:
        self._active = False
        self.stt.cancel_capture()
        await self.conversation.cancel()
        if self._microphone_task:
            self._microphone_task.cancel()
            self._microphone_task = None
        self._set_status(VoiceStatus.IDLE)

    def update_settings(self, settings: VoiceSettings) -> None:
        self.settings = settings
        self.stt.configure(settings)
        self.tts.configure(settings)
        self._save_settings(settings)

    def close(self) -> None:
        """Stop voice work before stopping its event loop during application shutdown."""
        try:
            self.submit(self.stop()).result(timeout=3)
            self.submit(self.tts.close()).result(timeout=3)
        except Exception:
            self._logger.debug("Voice shutdown cleanup did not finish cleanly.", exc_info=True)
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=3)

    async def _microphone_loop(self) -> None:
        while self._active:
            try:
                transcript = await self.stt.listen_once(self._on_speech_start)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                self._logger.exception("Microphone capture failed.")
                self._emit(VoiceEvent(VoiceEventKind.ERROR, text=str(error)))
                self._set_status(VoiceStatus.ERROR)
                self._active = False
                return
            if not transcript:
                continue
            self._emit(VoiceEvent(VoiceEventKind.TRANSCRIPT, text=transcript))
            if self._conversation_id is None:
                continue
            self._set_status(VoiceStatus.THINKING)
            await self.conversation.respond(
                self._conversation_id,
                transcript,
                self._on_response_chunk,
                lambda: self._set_status(VoiceStatus.SPEAKING),
                self._on_response_complete,
            )

    def _on_speech_start(self) -> None:
        """Called by the capture thread as soon as voice activity is detected."""
        self._loop.call_soon_threadsafe(self._barge_in)

    def _barge_in(self) -> None:
        if self.tts.is_busy or self.conversation.is_responding:
            asyncio.create_task(self.conversation.cancel())
        self._set_status(VoiceStatus.LISTENING)

    def _on_response_chunk(self, text: str) -> None:
        self._emit(VoiceEvent(VoiceEventKind.RESPONSE_CHUNK, text=text))

    def _on_response_complete(self) -> None:
        self._emit(VoiceEvent(VoiceEventKind.RESPONSE_COMPLETE))
        if self._active:
            self._set_status(VoiceStatus.LISTENING)

    def _set_status(self, status: VoiceStatus) -> None:
        self._status = status
        self._emit(VoiceEvent(VoiceEventKind.STATUS, status=status))

    def _emit(self, event: VoiceEvent) -> None:
        with self._listeners_lock:
            listeners = tuple(self._listeners)
        for listener in listeners:
            try:
                listener(event)
            except Exception:
                self._logger.exception("Voice event listener failed.")

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._ready.set()
        self._loop.run_forever()
        pending = asyncio.all_tasks(self._loop)
        for task in pending:
            task.cancel()
        if pending:
            self._loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        self._loop.close()

    def _load_settings(self) -> VoiceSettings:
        return VoiceSettings(
            voice=self.database.get_setting("voice.voice", VoiceSettings.voice),
            rate=self.database.get_setting("voice.rate", VoiceSettings.rate),
            volume=int(self.database.get_setting("voice.volume", str(VoiceSettings.volume))),
            input_device=self.database.get_setting("voice.input_device"),
            output_device=self.database.get_setting("voice.output_device"),
            language=self.database.get_setting("voice.language", VoiceSettings.language),
            whisper_model=self.database.get_setting("voice.whisper_model", VoiceSettings.whisper_model),
        )

    def _save_settings(self, settings: VoiceSettings) -> None:
        self.database.set_setting("voice.voice", settings.voice)
        self.database.set_setting("voice.rate", settings.rate)
        self.database.set_setting("voice.volume", str(settings.volume))
        self.database.set_setting("voice.input_device", settings.input_device)
        self.database.set_setting("voice.output_device", settings.output_device)
        self.database.set_setting("voice.language", settings.language)
        self.database.set_setting("voice.whisper_model", settings.whisper_model)
