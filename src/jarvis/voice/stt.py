"""Asynchronous continuous-utterance capture and layered speech-to-text."""

import asyncio
import logging
import queue
import threading
from collections.abc import Callable

from jarvis.core.errors import CapabilityUnavailable
from jarvis.voice.models import AudioDevice, VoiceSettings


class STTManager:
    """Captures one voice activity bounded utterance, preferring local Faster-Whisper."""

    SAMPLE_RATE = 16_000
    BLOCK_SECONDS = 0.1
    VOICE_THRESHOLD = 0.014
    END_SILENCE_SECONDS = 0.8
    MAX_UTTERANCE_SECONDS = 45

    def __init__(self, settings: VoiceSettings) -> None:
        self.settings = settings
        self._logger = logging.getLogger("jarvis.voice.stt")
        self._capture_stop = threading.Event()
        self._model: object | None = None
        self._model_lock = threading.Lock()

    def configure(self, settings: VoiceSettings) -> None:
        self.settings = settings

    def cancel_capture(self) -> None:
        """Ask the background capture loop to return promptly."""
        self._capture_stop.set()

    async def listen_once(self, on_speech_start: Callable[[], None]) -> str | None:
        """Capture the next utterance without ever blocking the asyncio event loop."""
        self._capture_stop.clear()
        samples = await asyncio.to_thread(self._capture_utterance, on_speech_start)
        if samples is None:
            return None
        return await self.transcribe(samples)

    async def transcribe(self, samples: object) -> str:
        """Try Faster-Whisper first; only use the cloud fallback if it is unavailable."""
        try:
            return await asyncio.to_thread(self._transcribe_faster_whisper, samples)
        except ModuleNotFoundError:
            self._logger.info("faster-whisper is unavailable; using SpeechRecognition fallback.")
        except Exception:
            self._logger.exception("Faster-Whisper transcription failed; trying fallback.")
        return await asyncio.to_thread(self._transcribe_speech_recognition, samples)

    def _capture_utterance(self, on_speech_start: Callable[[], None]) -> object | None:
        try:
            import numpy
            import sounddevice
        except ImportError as error:
            raise CapabilityUnavailable(
                "Install JARVIS with the 'voice' extra to use continuous microphone input."
            ) from error

        blocks: queue.Queue[object] = queue.Queue()
        started = False
        silence_seconds = 0.0
        captured_seconds = 0.0
        block_seconds = self.BLOCK_SECONDS

        def on_audio(indata: object, _frames: int, _time: object, status: object) -> None:
            if status:
                self._logger.warning("Microphone stream status: %s", status)
            blocks.put(indata.copy())  # type: ignore[attr-defined]

        try:
            with sounddevice.InputStream(
                device=self.settings.input_device or None,
                channels=1,
                samplerate=self.SAMPLE_RATE,
                blocksize=int(self.SAMPLE_RATE * block_seconds),
                dtype="float32",
                callback=on_audio,
            ):
                samples: list[object] = []
                while not self._capture_stop.is_set():
                    try:
                        block = blocks.get(timeout=0.25)
                    except queue.Empty:
                        continue
                    level = float(numpy.sqrt(numpy.mean(numpy.square(block))))
                    captured_seconds += block_seconds
                    if level >= self.VOICE_THRESHOLD:
                        if not started:
                            started = True
                            on_speech_start()
                        silence_seconds = 0.0
                    elif started:
                        silence_seconds += block_seconds
                    if started:
                        samples.append(block)
                    if started and silence_seconds >= self.END_SILENCE_SECONDS:
                        break
                    if captured_seconds >= self.MAX_UTTERANCE_SECONDS:
                        break
        except Exception as error:
            raise CapabilityUnavailable(f"Could not access the selected microphone: {error}") from error
        if not started or not samples:
            return None
        return numpy.concatenate(samples, axis=0).reshape(-1)

    def _transcribe_faster_whisper(self, samples: object) -> str:
        from faster_whisper import WhisperModel

        with self._model_lock:
            if self._model is None:
                self._logger.info("Loading Faster-Whisper model: %s", self.settings.whisper_model)
                self._model = WhisperModel(
                    self.settings.whisper_model,
                    device="auto",
                    compute_type="int8",
                )
            model = self._model
        language = None if self.settings.language == "auto" else self.settings.language.split("-")[0]
        segments, _info = model.transcribe(  # type: ignore[attr-defined]
            samples,
            beam_size=1,
            language=language,
            vad_filter=True,
        )
        return " ".join(segment.text.strip() for segment in segments).strip()

    def _transcribe_speech_recognition(self, samples: object) -> str:
        try:
            import numpy
            import speech_recognition as speech
        except ImportError as error:
            raise CapabilityUnavailable(
                "Install the 'whisper' or 'speech' JARVIS extra to enable transcription."
            ) from error
        pcm = (numpy.clip(samples, -1, 1) * 32767).astype("int16").tobytes()
        audio = speech.AudioData(pcm, self.SAMPLE_RATE, 2)
        recognizer = speech.Recognizer()
        try:
            return str(recognizer.recognize_google(audio, language=self.settings.language)).strip()
        except speech.UnknownValueError:
            return ""
        except speech.RequestError as error:
            raise CapabilityUnavailable("Speech recognition fallback is unavailable.") from error

    @staticmethod
    def devices() -> list[AudioDevice]:
        """Return input/output device names for the settings UI without opening a stream."""
        try:
            import sounddevice
        except ImportError:
            return []
        try:
            raw_devices = sounddevice.query_devices()
        except Exception:
            return []
        return [
            AudioDevice(
                name=str(device["name"]),
                is_input=int(device["max_input_channels"]) > 0,
                is_output=int(device["max_output_channels"]) > 0,
            )
            for device in raw_devices
        ]
