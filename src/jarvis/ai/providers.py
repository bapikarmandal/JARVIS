"""Concrete, network-backed model provider adapters."""

import json
from collections.abc import AsyncIterator, Sequence
from typing import Protocol

import httpx

from jarvis.core.errors import ProviderConfigurationError, ProviderResponseError
from jarvis.core.models import ChatMessage, ModelProfile, ProviderKind


class AIProvider(Protocol):
    async def complete(self, messages: Sequence[ChatMessage]) -> str: ...

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]: ...


class OpenAICompatibleProvider:
    def __init__(self, profile: ModelProfile, api_key: str) -> None:
        self.profile, self.api_key = profile, api_key

    async def complete(self, messages: Sequence[ChatMessage]) -> str:
        return "".join([chunk async for chunk in self.stream(messages)])

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        if not self.api_key:
            raise ProviderConfigurationError("Add an API key in Settings before sending a message.")
        base_url = self.profile.base_url.rstrip("/")
        if not base_url:
            raise ProviderConfigurationError("Set an OpenAI-compatible base URL in Settings.")
        payload = {
            "model": self.profile.model,
            "stream": True,
            "messages": [
                {"role": message.role.value, "content": message.content} for message in messages
            ],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        body = line.removeprefix("data: ")
                        if body == "[DONE]":
                            return
                        content = json.loads(body)["choices"][0]["delta"].get("content")
                        if content:
                            yield str(content)
            except httpx.HTTPError as error:
                raise ProviderResponseError(
                    "The OpenAI-compatible request failed. Check the endpoint and model settings."
                ) from error
class OllamaProvider:
    def __init__(self, profile: ModelProfile) -> None:
        self.profile = profile

    async def complete(self, messages: Sequence[ChatMessage]) -> str:
        return "".join([chunk async for chunk in self.stream(messages)])

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        base_url = (self.profile.base_url or "http://127.0.0.1:11434").rstrip("/")
        payload = {
            "model": self.profile.model,
            "stream": True,
            "messages": [{"role": item.role.value, "content": item.content} for item in messages],
        }
        async with httpx.AsyncClient(timeout=120) as client:
            try:
                async with client.stream("POST", f"{base_url}/api/chat", json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        content = json.loads(line).get("message", {}).get("content")
                        if content:
                            yield str(content)
            except httpx.HTTPError as error:
                raise ProviderResponseError(
                    "Could not reach Ollama. Check that Ollama is running."
                ) from error
class GeminiProvider:
    def __init__(self, profile: ModelProfile, api_key: str) -> None:
        self.profile, self.api_key = profile, api_key

    async def complete(self, messages: Sequence[ChatMessage]) -> str:
        return "".join([chunk async for chunk in self.stream(messages)])

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        if not self.api_key:
            raise ProviderConfigurationError(
                "Add your Gemini API key in Settings before sending a message."
            )
        contents = [
            {
                "role": "model" if item.role.value == "assistant" else "user",
                "parts": [{"text": item.content}],
            }
            for item in messages
            if item.role.value != "system"
        ]
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.profile.model}:streamGenerateContent"
        )
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                async with client.stream(
                    "POST",
                    endpoint,
                    params={"key": self.api_key, "alt": "sse"},
                    json={"contents": contents},
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        candidate = json.loads(line.removeprefix("data: "))["candidates"][0]
                        for part in candidate["content"].get("parts", []):
                            if text := part.get("text"):
                                yield str(text)
            except httpx.HTTPError as error:
                raise ProviderResponseError(
                    "The Gemini request failed. Check your API key, model, and connection."
                ) from error
def make_provider(profile: ModelProfile, api_key: str | None) -> AIProvider:
    """Build a provider without ever persisting the supplied secret."""
    if not profile.model.strip():
        raise ProviderConfigurationError("Choose a model in Settings before sending a message.")
    if profile.provider is ProviderKind.OLLAMA:
        return OllamaProvider(profile)
    if profile.provider is ProviderKind.GEMINI:
        return GeminiProvider(profile, api_key or "")
    return OpenAICompatibleProvider(profile, api_key or "")
