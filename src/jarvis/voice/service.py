"""Reliable non-blocking text-to-speech facade."""

import logging
import threading
from queue import Queue

from jarvis.core.errors import CapabilityUnavailable


class VoiceService:
    """Uses one serialized pyttsx3 engine when the optional voice package is installed."""

    def __init__(self) -> None:
        self._speech_queue: Queue[str] = Queue()
        self._worker: threading.Thread | None = None
        self._worker_lock = threading.Lock()
        self._logger = logging.getLogger("jarvis.voice")

    def speak(self, text: str) -> None:
        """Queue speech without allowing concurrent pyttsx3 event loops."""
        if not text.strip():
            return
        try:
            import pyttsx3
        except ImportError as error:
            raise CapabilityUnavailable(
                "Install JARVIS with the 'voice' extra to enable speech output."
            ) from error
        with self._worker_lock:
            if self._worker is None or not self._worker.is_alive():
                self._worker = threading.Thread(
                    target=self._run_speech_worker,
                    args=(pyttsx3,),
                    daemon=True,
                    name="jarvis-tts",
                )
                self._worker.start()
        self._speech_queue.put(text.strip())

    def _run_speech_worker(self, pyttsx3: object) -> None:
        """Own the engine and process speech requests in order on one thread."""
        try:
            engine = pyttsx3.init()  # type: ignore[attr-defined]
        except Exception:
            self._logger.exception("Unable to initialize the local text-to-speech engine.")
            return
        while True:
            text = self._speech_queue.get()
            try:
                engine.say(text)
                engine.runAndWait()
            except Exception:
                self._logger.exception("Text-to-speech playback failed.")
            finally:
                self._speech_queue.task_done()

    def transcribe_once(self, language: str = "en-US") -> str:
        """Record only after an explicit user gesture, then return one utterance."""
        try:
            import speech_recognition as speech
        except ImportError as error:
            raise CapabilityUnavailable(
                "Install JARVIS with the 'voice' extra to enable push-to-talk transcription."
            ) from error
        try:
            microphone = speech.Microphone
            microphone.get_pyaudio()
        except (AttributeError, OSError) as error:
            raise CapabilityUnavailable(
                "Install a CPython 3.14-compatible PortAudio/PyAudio backend to use the microphone."
            ) from error
        recognizer = speech.Recognizer()
        try:
            with microphone() as source:
                recognizer.adjust_for_ambient_noise(source, duration=0.4)
                audio = recognizer.listen(source, timeout=8, phrase_time_limit=45)
            return str(recognizer.recognize_google(audio, language=language))
        except speech.WaitTimeoutError as error:
            raise CapabilityUnavailable(
                "No speech was detected before the listening timeout."
            ) from error
        except speech.UnknownValueError as error:
            raise CapabilityUnavailable("JARVIS could not understand that speech.") from error
        except speech.RequestError as error:
            raise CapabilityUnavailable(
                "The selected speech recognition service is unavailable."
            ) from error
