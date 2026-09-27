"""Stable contract for JARVIS capability plugins."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class PluginManifest:
    id: str
    name: str
    version: str
    description: str
    permissions: tuple[str, ...] = ()


class Plugin(ABC):
    """A fault-isolated extension point with an explicit lifecycle."""

    manifest: PluginManifest

    @abstractmethod
    def initialize(self) -> None: ...

    @abstractmethod
    def execute(self, command: str, payload: dict[str, Any]) -> Any: ...

    @abstractmethod
    def shutdown(self) -> None: ...
