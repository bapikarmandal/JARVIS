"""Voice-domain models shared by the asynchronous conversation pipeline."""

from dataclasses import dataclass
from enum import StrEnum


class VoiceStatus(StrEnum):
    IDLE = "Idle"
    LISTENING = "Listening"
    THINKING = "Thinking"
    SPEAKING = "Speaking"
    ERROR = "Error"


class VoiceEventKind(StrEnum):
    STATUS = "status"
    TRANSCRIPT = "transcript"
    RESPONSE_CHUNK = "response_chunk"
    RESPONSE_COMPLETE = "response_complete"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class VoiceSettings:
    voice: str = "en-US-AriaNeural"
    rate: str = "+0%"
    volume: int = 100
    input_device: str = ""
    output_device: str = ""
    language: str = "en-US"
    whisper_model: str = "base.en"


@dataclass(frozen=True, slots=True)
class AudioDevice:
    name: str
    is_input: bool
    is_output: bool


@dataclass(frozen=True, slots=True)
class VoiceEvent:
    kind: VoiceEventKind
    text: str = ""
    status: VoiceStatus | None = None
