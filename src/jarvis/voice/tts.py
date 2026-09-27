"""Edge-TTS synthesis and interruptible audio playback."""

import asyncio
import logging
import tempfile
from pathlib import Path

from jarvis.core.errors import CapabilityUnavailable
from jarvis.voice.models import VoiceSettings


class TTSManager:
    """Queues sentence-level Edge-TTS audio and can stop playback immediately."""

    def __init__(self, settings: VoiceSettings) -> None:
        self.settings = settings
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._generation = 0
        self._speaking = False
        self._logger = logging.getLogger("jarvis.voice.tts")

    @property
    def is_busy(self) -> bool:
        return self._speaking or not self._queue.empty()

    def configure(self, settings: VoiceSettings) -> None:
        self.settings = settings

    async def start(self) -> None:
        if self._worker is None or self._worker.done():
            self._worker = asyncio.create_task(self._run(), name="jarvis-edge-tts")

    async def enqueue(self, text: str) -> None:
        if text.strip():
            await self._queue.put(text.strip())

    async def wait_until_idle(self) -> None:
        await self._queue.join()
        while self._speaking:
            await asyncio.sleep(0.03)

    async def interrupt(self) -> None:
        """Drop queued sentences and stop the currently audible output."""
        self._generation += 1
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except asyncio.QueueEmpty:
                break
        try:
            import sounddevice

            sounddevice.stop()
        except ImportError:
            return
        except Exception:
            self._logger.debug("Audio stop request failed.", exc_info=True)

    async def close(self) -> None:
        await self.interrupt()
        if self._worker:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
            self._worker = None

    async def _run(self) -> None:
        while True:
            text = await self._queue.get()
            generation = self._generation
            self._speaking = True
            try:
                await self._synthesize_and_play(text, generation)
            except asyncio.CancelledError:
                raise
            except CapabilityUnavailable:
                raise
            except Exception:
                self._logger.exception("Edge-TTS playback failed.")
            finally:
                self._speaking = False
                self._queue.task_done()

    async def _synthesize_and_play(self, text: str, generation: int) -> None:
        try:
            import edge_tts
            import sounddevice
            import soundfile
        except ImportError as error:
            raise CapabilityUnavailable(
                "Install JARVIS with the 'voice' extra to enable Edge-TTS output."
            ) from error
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as stream:
            path = Path(stream.name)
        try:
            communicate = edge_tts.Communicate(
                text,
                voice=self.settings.voice,
                rate=self.settings.rate,
                volume=f"{self.settings.volume - 100:+d}%",
            )
            await communicate.save(str(path))
            if generation != self._generation:
                return
            audio, sample_rate = await asyncio.to_thread(
                soundfile.read,
                str(path),
                dtype="float32",
                always_2d=True,
            )
            if generation != self._generation:
                return
            sounddevice.play(
                audio,
                sample_rate,
                device=self.settings.output_device or None,
                blocking=False,
            )
            await asyncio.to_thread(sounddevice.wait)
        except Exception as error:
            raise CapabilityUnavailable(f"Voice output failed: {error}") from error
        finally:
            path.unlink(missing_ok=True)
