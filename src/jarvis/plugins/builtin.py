"""First-party plugins that expose existing services through the common contract."""

from typing import Any

from jarvis.memory.service import MemoryService
from jarvis.plugins.base import Plugin, PluginManifest
from jarvis.system.service import SystemService


class MemoryPlugin(Plugin):
    manifest = PluginManifest(
        "memory", "Memory", "1.0.0", "Stores and retrieves user-approved facts."
    )

    def __init__(self, service: MemoryService) -> None:
        self.service = service

    def initialize(self) -> None:
        return None

    def execute(self, command: str, payload: dict[str, Any]) -> Any:
        if command == "remember":
            return self.service.remember(payload["content"], payload.get("category", "fact"))
        if command == "search":
            return self.service.search(payload["query"])
        raise ValueError(f"Unsupported memory command: {command}")

    def shutdown(self) -> None:
        return None


class SystemPlugin(Plugin):
    manifest = PluginManifest(
        "system",
        "System utilities",
        "1.0.0",
        "Opens URLs and captures screenshots.",
        ("system.open_url", "system.screenshot"),
    )

    def __init__(self, service: SystemService) -> None:
        self.service = service

    def initialize(self) -> None:
        return None

    def execute(self, command: str, payload: dict[str, Any]) -> Any:
        if command == "open_url":
            return self.service.open_url(payload["url"])
        if command == "screenshot":
            return self.service.take_screenshot()
        raise ValueError(f"Unsupported system command: {command}")

    def shutdown(self) -> None:
        return None
