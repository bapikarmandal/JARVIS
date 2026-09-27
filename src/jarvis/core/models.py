"""Shared, dependency-light domain models."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4


class ProviderKind(StrEnum):
    GEMINI = "gemini"
    OPENAI_COMPATIBLE = "openai_compatible"
    OLLAMA = "ollama"


class RiskLevel(StrEnum):
    SAFE = "safe"
    CONFIRM = "confirm"
    DANGEROUS = "dangerous"


class MessageRole(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: MessageRole
    content: str
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ModelProfile:
    provider: ProviderKind
    model: str
    base_url: str = ""


@dataclass(frozen=True, slots=True)
class ConfirmationRequest:
    action: str
    detail: str
    token: UUID

    @classmethod
    def create(cls, action: str, detail: str) -> ConfirmationRequest:
        return cls(action=action, detail=detail, token=uuid4())
