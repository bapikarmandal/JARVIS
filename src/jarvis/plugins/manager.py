"""Plugin registration and lifecycle isolation."""

import logging
from dataclasses import dataclass
from typing import Any

from jarvis.plugins.base import Plugin


@dataclass(slots=True)
class PluginStatus:
    plugin: Plugin
    enabled: bool = False
    error: str = ""


class PluginManager:
    """A failing plugin is disabled without taking down the desktop process."""

    def __init__(self) -> None:
        self._plugins: dict[str, PluginStatus] = {}
        self._logger = logging.getLogger("jarvis.plugins")

    def register(self, plugin: Plugin) -> None:
        plugin_id = plugin.manifest.id
        if plugin_id in self._plugins:
            raise ValueError(f"Plugin already registered: {plugin_id}")
        status = PluginStatus(plugin=plugin)
        self._plugins[plugin_id] = status
        try:
            plugin.initialize()
            status.enabled = True
        except Exception as error:  # Plugins are a process boundary by design.
            status.error = str(error)
            self._logger.exception("Plugin initialization failed: %s", plugin_id)

    def execute(self, plugin_id: str, command: str, payload: dict[str, Any]) -> Any:
        status = self._plugins[plugin_id]
        if not status.enabled:
            raise RuntimeError(f"Plugin '{plugin_id}' is disabled: {status.error or 'unavailable'}")
        return status.plugin.execute(command, payload)

    def statuses(self) -> list[PluginStatus]:
        return list(self._plugins.values())

    def shutdown(self) -> None:
        for status in self._plugins.values():
            if status.enabled:
                try:
                    status.plugin.shutdown()
                except Exception:
                    self._logger.exception("Plugin shutdown failed: %s", status.plugin.manifest.id)
