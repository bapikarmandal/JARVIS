"""Composition root: constructs services once and injects them into the UI."""

import logging
from dataclasses import dataclass
from pathlib import Path

from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication

from jarvis.ai.service import ChatService
from jarvis.automation.reminders import ReminderService
from jarvis.core.logging import configure_logging
from jarvis.core.safety import SafetyGate
from jarvis.memory.service import MemoryService
from jarvis.plugins.builtin import MemoryPlugin, SystemPlugin
from jarvis.plugins.manager import PluginManager
from jarvis.storage.database import Database
from jarvis.storage.secrets import SecretStore
from jarvis.system.service import SystemService
from jarvis.ui.main_window import MainWindow
from jarvis.voice.service import VoiceService


@dataclass(frozen=True, slots=True)
class Services:
    database: Database
    chat: ChatService
    memory: MemoryService
    reminders: ReminderService
    plugins: PluginManager
    system: SystemService
    secrets: SecretStore
    voice: VoiceService
    safety: SafetyGate


class JarvisApplication:
    """Coordinates lifecycle-bound services without embedding business logic in widgets."""

    def __init__(self, qt_app: QApplication, data_directory: Path | None = None) -> None:
        self.qt_app = qt_app
        self.data_directory = data_directory or Path.home() / ".jarvis"
        logger = configure_logging(self.data_directory / "logs")
        self.services = self._build_services()
        self.window = MainWindow(self.services)
        self._reminder_timer = QTimer()
        self._reminder_timer.setInterval(15_000)
        self._reminder_timer.timeout.connect(self._deliver_reminders)
        self._reminder_timer.start()
        qt_app.aboutToQuit.connect(self.shutdown)
        logger.info("JARVIS initialized.")

    def _build_services(self) -> Services:
        database = Database(self.data_directory / "jarvis.db")
        database.initialize()
        memories = MemoryService(database)
        safety = SafetyGate()
        system = SystemService(self.data_directory, safety)
        plugins = PluginManager()
        plugins.register(MemoryPlugin(memories))
        plugins.register(SystemPlugin(system))
        secrets = SecretStore()
        return Services(
            database=database,
            chat=ChatService(database, memories, secrets),
            memory=memories,
            reminders=ReminderService(database),
            plugins=plugins,
            system=system,
            secrets=secrets,
            voice=VoiceService(),
            safety=safety,
        )

    def _deliver_reminders(self) -> None:
        delivered = self.services.reminders.deliver_due(self.window.show_reminder)
        if delivered:
            self.services.database.log("automation", "info", f"Delivered {delivered} reminder(s).")

    def show(self) -> None:
        self.window.show()

    def shutdown(self) -> None:
        self._reminder_timer.stop()
        self.services.safety.revoke_all()
        self.services.plugins.shutdown()
        logging.getLogger("jarvis").info("JARVIS shut down.")
