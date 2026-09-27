"""Main desktop workspace and focused, functional views."""

import asyncio
from collections.abc import Callable

from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QScrollArea,
    QSpinBox,
    QStackedWidget,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)

from jarvis.core.errors import JarvisError
from jarvis.core.models import ProviderKind


def card() -> tuple[QFrame, QVBoxLayout]:
    """Create a styled surface used consistently across every workspace section."""
    frame = QFrame()
    frame.setObjectName("card")
    layout = QVBoxLayout(frame)
    layout.setContentsMargins(18, 18, 18, 18)
    layout.setSpacing(10)
    return frame, layout


def page_header(title: str, eyebrow: str) -> QVBoxLayout:
    layout = QVBoxLayout()
    layout.setSpacing(2)
    label = QLabel(eyebrow.upper())
    label.setObjectName("eyebrow")
    layout.addWidget(label)
    heading = QLabel(title)
    heading.setObjectName("title")
    layout.addWidget(heading)
    return layout


class ChatWorker(QThread):
    completed = Signal(str)
    failed = Signal(str)

    def __init__(self, service: object, conversation_id: int, text: str) -> None:
        super().__init__()
        self.service, self.conversation_id, self.text = service, conversation_id, text

    def run(self) -> None:
        try:
            response = asyncio.run(self.service.reply(self.conversation_id, self.text))  # type: ignore[attr-defined]
        except Exception as error:
            self.failed.emit(str(error))
        else:
            self.completed.emit(response)


class TranscriptionWorker(QThread):
    completed = Signal(str)
    failed = Signal(str)

    def __init__(self, service: object) -> None:
        super().__init__()
        self.service = service

    def run(self) -> None:
        try:
            transcript = self.service.transcribe_once()  # type: ignore[attr-defined]
        except Exception as error:
            self.failed.emit(str(error))
        else:
            self.completed.emit(transcript)


class ChatPage(QWidget):
    """Conversation view with an off-thread, provider-backed response pipeline."""

    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        self.conversation_id = services.database.create_conversation()
        self.worker: ChatWorker | None = None
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.setSpacing(14)
        header = QHBoxLayout()
        header.addLayout(page_header("Command center", "Conversation"))
        header.addStretch()
        self.provider_label = QLabel()
        self.provider_label.setObjectName("eyebrow")
        header.addWidget(self.provider_label, alignment=Qt.AlignmentFlag.AlignBottom)
        self.history = QComboBox()
        self.history.setMinimumWidth(190)
        self.history.currentIndexChanged.connect(self.change_conversation)
        header.addWidget(self.history, alignment=Qt.AlignmentFlag.AlignBottom)
        reset = QPushButton("New chat")
        reset.clicked.connect(self.new_conversation)
        header.addWidget(reset, alignment=Qt.AlignmentFlag.AlignBottom)
        clear = QPushButton("Clear")
        clear.clicked.connect(self.clear_history)
        header.addWidget(clear, alignment=Qt.AlignmentFlag.AlignBottom)
        layout.addLayout(header)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.messages_widget = QWidget()
        self.messages = QVBoxLayout(self.messages_widget)
        self.messages.setContentsMargins(2, 2, 2, 2)
        self.messages.setSpacing(10)
        self.messages.addStretch()
        scroll.setWidget(self.messages_widget)
        layout.addWidget(scroll, 1)
        self.scroll = scroll

        composer, composer_layout = card()
        self.input = QPlainTextEdit()
        self.input.setPlaceholderText("Ask JARVIS anything…  (Ctrl+Enter to send)")
        self.input.setFixedHeight(78)
        composer_layout.addWidget(self.input)
        footer = QHBoxLayout()
        footer.addWidget(
            QLabel("JARVIS keeps model calls deliberate and system actions permissioned.")
        )
        footer.addStretch()
        self.send = QPushButton("Send  ↗")
        self.send.clicked.connect(self.send_message)
        footer.addWidget(self.send)
        composer_layout.addLayout(footer)
        layout.addWidget(composer)
        self.refresh_provider()
        self.refresh_conversations()
        self.add_bubble(
            "assistant",
            "**JARVIS online.** Configure a model in Settings, then start a conversation.",
        )

    def refresh_provider(self) -> None:
        profile = self.services.chat.profile()
        self.provider_label.setText(f"{profile.provider.value} · {profile.model}")

    def add_bubble(self, role: str, content: str) -> None:
        frame, bubble_layout = card()
        frame.setMaximumWidth(780)
        frame.setStyleSheet("QFrame#card { background: #12324b; }" if role == "user" else "")
        role_label = QLabel("YOU" if role == "user" else "JARVIS")
        role_label.setObjectName("eyebrow")
        browser = QTextBrowser()
        browser.setOpenExternalLinks(True)
        browser.setMarkdown(content)
        browser.document().setDocumentMargin(0)
        bubble_layout.addWidget(role_label)
        bubble_layout.addWidget(browser)
        row = QHBoxLayout()
        if role == "user":
            row.addStretch()
        row.addWidget(frame)
        if role != "user":
            row.addStretch()
        self.messages.insertLayout(self.messages.count() - 1, row)
        self.scroll.verticalScrollBar().rangeChanged.connect(
            lambda _minimum, maximum: self.scroll.verticalScrollBar().setValue(maximum)
        )

    def send_message(self) -> None:
        text = self.input.toPlainText().strip()
        if not text or self.worker is not None:
            return
        self.input.clear()
        self.add_bubble("user", text)
        self.send.setEnabled(False)
        self.worker = ChatWorker(self.services.chat, self.conversation_id, text)
        self.worker.completed.connect(self.on_response)
        self.worker.failed.connect(self.on_failure)
        self.worker.finished.connect(self.worker_finished)
        self.worker.start()

    def worker_finished(self) -> None:
        self.send.setEnabled(True)
        if self.worker:
            self.worker.deleteLater()
        self.worker = None

    def on_response(self, response: str) -> None:
        self.add_bubble("assistant", response)
        self.refresh_conversations()

    def on_failure(self, message: str) -> None:
        self.services.database.log("ai", "error", message)
        self.add_bubble("assistant", f"**Unable to complete that request.**\n\n{message}")

    def new_conversation(self) -> None:
        if self.worker is not None:
            return
        self.conversation_id = self.services.database.create_conversation()
        self.clear_bubbles()
        self.refresh_conversations()
        self.add_bubble("assistant", "New conversation ready. What can I help with?")

    def clear_history(self) -> None:
        if self.worker is not None:
            return
        answer = QMessageBox.question(
            self,
            "Clear chat history",
            "Remove all messages from this conversation? This cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if answer is not QMessageBox.StandardButton.Yes:
            return
        self.services.database.clear_conversation(self.conversation_id)
        self.clear_bubbles()
        self.add_bubble("assistant", "Conversation history cleared. How can I help?")
        self.services.database.log("chat", "info", "Cleared a conversation history.")

    def refresh_conversations(self) -> None:
        self.history.blockSignals(True)
        self.history.clear()
        selected_index = 0
        for index, conversation in enumerate(self.services.database.list_conversations()):
            self.history.addItem(str(conversation["title"]), int(conversation["id"]))
            if int(conversation["id"]) == self.conversation_id:
                selected_index = index
        self.history.setCurrentIndex(selected_index)
        self.history.blockSignals(False)

    def change_conversation(self, _index: int) -> None:
        selected = self.history.currentData()
        if selected is None or int(selected) == self.conversation_id or self.worker is not None:
            return
        self.conversation_id = int(selected)
        self.clear_bubbles()
        messages = self.services.database.messages(self.conversation_id)
        if messages:
            for message in messages:
                self.add_bubble(message.role.value, message.content)
        else:
            self.add_bubble("assistant", "This conversation has no messages yet.")

    def clear_bubbles(self) -> None:
        while self.messages.count() > 1:
            item = self.messages.takeAt(0)
            if item and item.layout():
                self._delete_layout(item.layout())

    @staticmethod
    def _delete_layout(layout: QHBoxLayout) -> None:
        while layout.count():
            item = layout.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()


class HomePage(QWidget):
    def __init__(self, services: object) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("Good evening, Commander.", "JARVIS desktop assistant"))
        layout.addSpacing(12)
        status, status_layout = card()
        status_layout.addWidget(QLabel("SYSTEM STATUS"), alignment=Qt.AlignmentFlag.AlignLeft)
        system = services.system.system_summary()
        status_layout.addWidget(QLabel(f"Ready · {system['platform']} · Python {system['python']}"))
        layout.addWidget(status)
        grid = QHBoxLayout()
        for title, copy in (
            ("Chat", "Talk to your configured local or cloud model."),
            ("Memory", "Save and search facts you explicitly want retained."),
            ("Automation", "Set local reminders that survive app restarts."),
        ):
            surface, surface_layout = card()
            surface_layout.addWidget(QLabel(title))
            surface_layout.addWidget(QLabel(copy))
            grid.addWidget(surface)
        layout.addLayout(grid)
        layout.addStretch()


class MemoryPage(QWidget):
    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("Memory vault", "Long-term memory"))
        add_card, add_layout = card()
        self.memory_text = QPlainTextEdit()
        self.memory_text.setPlaceholderText(
            "Store an explicit preference, project detail, or important fact…"
        )
        self.memory_text.setFixedHeight(68)
        add_layout.addWidget(self.memory_text)
        add_button = QPushButton("Remember")
        add_button.clicked.connect(self.remember)
        add_layout.addWidget(add_button, alignment=Qt.AlignmentFlag.AlignRight)
        layout.addWidget(add_card)
        search = QHBoxLayout()
        self.query = QLineEdit()
        self.query.setPlaceholderText("Search remembered facts")
        self.query.returnPressed.connect(self.refresh)
        search.addWidget(self.query)
        button = QPushButton("Search")
        button.clicked.connect(self.refresh)
        search.addWidget(button)
        layout.addLayout(search)
        self.results = QListWidget()
        self.results.itemDoubleClicked.connect(self.forget_selected)
        layout.addWidget(self.results, 1)
        layout.addWidget(QLabel("Double-click a result to forget it."))

    def remember(self) -> None:
        try:
            self.services.memory.remember(self.memory_text.toPlainText())
        except ValueError as error:
            QMessageBox.warning(self, "JARVIS", str(error))
            return
        self.memory_text.clear()
        self.refresh()
        self.services.database.log("memory", "info", "Stored an explicit user memory.")

    def refresh(self) -> None:
        self.results.clear()
        for memory in self.services.memory.search(self.query.text()):
            item = QListWidgetItem(f"[{memory.category}] {memory.content}")
            item.setData(Qt.ItemDataRole.UserRole, memory.id)
            self.results.addItem(item)

    def forget_selected(self, item: QListWidgetItem) -> None:
        if (
            QMessageBox.question(self, "Forget memory", "Permanently remove this stored memory?")
            == QMessageBox.StandardButton.Yes
        ):
            self.services.memory.forget(int(item.data(Qt.ItemDataRole.UserRole)))
            self.refresh()


class SettingsPage(QWidget):
    def __init__(self, services: object, on_saved: Callable[[], None]) -> None:
        super().__init__()
        self.services, self.on_saved = services, on_saved
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("Settings", "Model and privacy controls"))
        surface, form = card()
        form.addWidget(QLabel("AI provider"))
        self.provider = QComboBox()
        self.provider.addItems([kind.value for kind in ProviderKind])
        self.provider.setCurrentText(services.database.get_setting("provider", "ollama"))
        form.addWidget(self.provider)
        form.addWidget(QLabel("Model"))
        self.model = QLineEdit(services.database.get_setting("model", "llama3.2"))
        form.addWidget(self.model)
        form.addWidget(QLabel("Base URL (Ollama or OpenAI-compatible only)"))
        self.base_url = QLineEdit(
            services.database.get_setting("base_url", "http://127.0.0.1:11434")
        )
        form.addWidget(self.base_url)
        form.addWidget(QLabel("API key (stored in your OS credential manager)"))
        self.api_key = QLineEdit()
        self.api_key.setEchoMode(QLineEdit.EchoMode.Password)
        self.api_key.setPlaceholderText("Leave empty to keep the current key")
        form.addWidget(self.api_key)
        save = QPushButton("Save secure settings")
        save.clicked.connect(self.save)
        form.addWidget(save, alignment=Qt.AlignmentFlag.AlignRight)
        layout.addWidget(surface)
        layout.addStretch()

    def save(self) -> None:
        provider = self.provider.currentText()
        model = self.model.text().strip()
        if not model:
            QMessageBox.warning(self, "JARVIS", "A model name is required.")
            return
        self.services.database.set_setting("provider", provider)
        self.services.database.set_setting("model", model)
        self.services.database.set_setting("base_url", self.base_url.text().strip())
        if self.api_key.text().strip():
            try:
                self.services.secrets.set(f"provider:{provider}", self.api_key.text().strip())
            except JarvisError as error:
                QMessageBox.warning(self, "JARVIS", str(error))
                return
        self.api_key.clear()
        self.services.database.log("settings", "info", f"Updated {provider} model configuration.")
        self.on_saved()
        QMessageBox.information(
            self, "JARVIS", "Settings saved. API keys remain outside the JARVIS database."
        )


class PluginPage(QWidget):
    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("Capability plugins", "Extensible modules"))
        self.listing = QListWidget()
        layout.addWidget(self.listing, 1)
        refresh = QPushButton("Refresh status")
        refresh.clicked.connect(self.refresh)
        layout.addWidget(refresh, alignment=Qt.AlignmentFlag.AlignRight)
        self.refresh()

    def refresh(self) -> None:
        self.listing.clear()
        for status in self.services.plugins.statuses():
            manifest = status.plugin.manifest
            state = "Enabled" if status.enabled else f"Disabled — {status.error}"
            permissions = ", ".join(manifest.permissions) or "No sensitive permissions"
            self.listing.addItem(
                f"{manifest.name}  v{manifest.version}\n"
                f"{manifest.description}\n{state} · {permissions}"
            )


class AutomationPage(QWidget):
    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("Automation", "Local reminders"))
        surface, form = card()
        self.title = QLineEdit()
        self.title.setPlaceholderText("Reminder title")
        self.minutes = QSpinBox()
        self.minutes.setRange(1, 525_600)
        self.minutes.setValue(15)
        self.minutes.setSuffix(" minutes")
        form.addWidget(self.title)
        form.addWidget(self.minutes)
        create = QPushButton("Schedule reminder")
        create.clicked.connect(self.create)
        form.addWidget(create, alignment=Qt.AlignmentFlag.AlignRight)
        layout.addWidget(surface)
        layout.addWidget(
            QLabel("Reminders are stored locally and checked while JARVIS is running.")
        )
        layout.addStretch()

    def create(self) -> None:
        try:
            self.services.reminders.create_in(self.title.text(), self.minutes.value())
        except ValueError as error:
            QMessageBox.warning(self, "JARVIS", str(error))
            return
        self.services.database.log("automation", "info", "Scheduled a local reminder.")
        QMessageBox.information(self, "JARVIS", "Reminder scheduled.")
        self.title.clear()


class SystemPage(QWidget):
    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("System tools", "Permissioned utilities"))
        browser, browser_layout = card()
        self.url = QLineEdit("https://")
        browser_layout.addWidget(QLabel("Open a website"))
        browser_layout.addWidget(self.url)
        open_button = QPushButton("Open in browser")
        open_button.clicked.connect(self.open_url)
        browser_layout.addWidget(open_button, alignment=Qt.AlignmentFlag.AlignRight)
        layout.addWidget(browser)
        screenshot, shot_layout = card()
        shot_layout.addWidget(QLabel("Capture a screenshot"))
        shot_layout.addWidget(
            QLabel("Requires the optional vision dependency and access to this desktop session.")
        )
        capture = QPushButton("Capture screenshot")
        capture.clicked.connect(self.capture)
        shot_layout.addWidget(capture, alignment=Qt.AlignmentFlag.AlignRight)
        layout.addWidget(screenshot)
        security, security_layout = card()
        security_layout.addWidget(QLabel("Power and destructive actions"))
        security_layout.addWidget(
            QLabel(
                "Each action opens a fresh confirmation. JARVIS never runs power commands "
                "from chat text or background automation."
            )
        )
        power_controls = QHBoxLayout()
        for action in ("lock", "sleep", "restart", "shutdown"):
            button = QPushButton(action.title())
            button.clicked.connect(
                lambda _checked=False, requested=action: self.request_power(requested)
            )
            power_controls.addWidget(button)
        security_layout.addLayout(power_controls)
        layout.addWidget(security)
        layout.addStretch()

    def open_url(self) -> None:
        try:
            opened = self.services.system.open_url(self.url.text().strip())
        except ValueError as error:
            QMessageBox.warning(self, "JARVIS", str(error))
            return
        self.services.database.log("system", "info", "Requested opening an external URL.")
        QMessageBox.information(
            self,
            "JARVIS",
            "Browser request sent." if opened else "The browser did not accept the request.",
        )

    def capture(self) -> None:
        try:
            location = self.services.system.take_screenshot()
        except JarvisError as error:
            QMessageBox.warning(self, "JARVIS", str(error))
            return
        self.services.database.log("system", "info", "Captured a screenshot.")
        QMessageBox.information(self, "JARVIS", f"Screenshot saved to:\n{location}")

    def request_power(self, action: str) -> None:
        try:
            request = self.services.system.request_power_action(action)
        except (JarvisError, ValueError) as error:
            QMessageBox.warning(self, "JARVIS", str(error))
            return
        answer = QMessageBox.warning(
            self,
            "Confirm system action",
            f"JARVIS is ready to {request.detail.lower()}.\n\nDo you want to continue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return
        try:
            self.services.system.execute_power_action(action, request.token)
        except (JarvisError, ValueError) as error:
            QMessageBox.warning(self, "JARVIS", str(error))
            return
        self.services.database.log(
            "security", "warning", f"Confirmed system power action: {action}."
        )


class VoicePage(QWidget):
    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        self.worker: TranscriptionWorker | None = None
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("Voice interface", "Speech output"))
        surface, form = card()
        form.addWidget(
            QLabel(
                "JARVIS can speak responses locally or transcribe one explicit "
                "push-to-talk utterance."
            )
        )
        self.text = QPlainTextEdit(
            "Hello. JARVIS voice output is ready when the optional voice package is installed."
        )
        self.text.setFixedHeight(100)
        form.addWidget(self.text)
        controls = QHBoxLayout()
        listen = QPushButton("◉  Push to talk")
        listen.setObjectName("mic")
        listen.clicked.connect(self.listen)
        controls.addWidget(listen)
        speak = QPushButton("◎  Speak")
        speak.setObjectName("mic")
        speak.clicked.connect(self.speak)
        controls.addWidget(speak)
        form.addLayout(controls)
        layout.addWidget(surface)
        note, note_layout = card()
        note_layout.addWidget(
            QLabel(
                "JARVIS listens only after you press Push to talk; it never opens the "
                "microphone in the background. Speech recognition may use the configured "
                "provider's online recognition service."
            )
        )
        layout.addWidget(note)
        layout.addStretch()

    def speak(self) -> None:
        try:
            self.services.voice.speak(self.text.toPlainText())
        except JarvisError as error:
            QMessageBox.warning(self, "JARVIS", str(error))

    def listen(self) -> None:
        if self.worker is not None:
            return
        self.worker = TranscriptionWorker(self.services.voice)
        self.worker.completed.connect(self.transcribed)
        self.worker.failed.connect(lambda message: QMessageBox.warning(self, "JARVIS", message))
        self.worker.finished.connect(self.listening_finished)
        self.worker.start()

    def transcribed(self, transcript: str) -> None:
        self.text.setPlainText(transcript)
        self.services.database.log(
            "voice", "info", "Completed an explicit push-to-talk transcription."
        )

    def listening_finished(self) -> None:
        if self.worker:
            self.worker.deleteLater()
        self.worker = None


class LogsPage(QWidget):
    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 26, 30, 24)
        layout.addLayout(page_header("Activity log", "Local audit trail"))
        self.logs = QTextBrowser()
        layout.addWidget(self.logs, 1)
        refresh = QPushButton("Refresh logs")
        refresh.clicked.connect(self.refresh)
        layout.addWidget(refresh, alignment=Qt.AlignmentFlag.AlignRight)
        self.refresh()

    def refresh(self) -> None:
        entries = self.services.database.recent_logs()
        self.logs.setPlainText(
            "\n".join(
                f"{item['created_at']}  [{item['level'].upper()}] "
                f"{item['category']}: {item['message']}"
                for item in entries
            )
        )


class MainWindow(QMainWindow):
    """Responsive workspace shell with deliberately compact navigation."""

    def __init__(self, services: object) -> None:
        super().__init__()
        self.services = services
        self.setWindowTitle("JARVIS")
        self.setMinimumSize(1050, 700)
        self.resize(1280, 800)
        root = QWidget()
        root.setObjectName("root")
        self.setCentralWidget(root)
        layout = QHBoxLayout(root)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        sidebar = QFrame()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(205)
        side_layout = QVBoxLayout(sidebar)
        side_layout.setContentsMargins(16, 22, 16, 18)
        brand = QLabel("JARVIS")
        brand.setObjectName("brand")
        side_layout.addWidget(brand)
        side_layout.addWidget(QLabel("PERSONAL OS"), alignment=Qt.AlignmentFlag.AlignLeft)
        side_layout.addSpacing(22)
        self.stack = QStackedWidget()
        self.chat = ChatPage(services)
        pages = {
            "Home": HomePage(services),
            "Chat": self.chat,
            "Voice": VoicePage(services),
            "Memory": MemoryPage(services),
            "Plugins": PluginPage(services),
            "Automation": AutomationPage(services),
            "System": SystemPage(services),
            "Settings": SettingsPage(services, self.chat.refresh_provider),
            "Logs": LogsPage(services),
        }
        self.pages = pages
        for name, widget in pages.items():
            self.stack.addWidget(widget)
            button = QPushButton(name)
            button.setObjectName("nav")
            button.setCheckable(True)
            button.clicked.connect(lambda _checked=False, target=widget: self.show_page(target))
            side_layout.addWidget(button)
            if name == "Home":
                button.setChecked(True)
        side_layout.addStretch()
        side_layout.addWidget(QLabel("SAFE MODE · LOCAL DATA"))
        layout.addWidget(sidebar)
        layout.addWidget(self.stack, 1)

    def show_page(self, page: QWidget) -> None:
        self.stack.setCurrentWidget(page)
        for button in self.findChildren(QPushButton, "nav"):
            button.setChecked(self.pages[button.text()] is page)
        if isinstance(page, LogsPage):
            page.refresh()
        if isinstance(page, MemoryPage):
            page.refresh()

    def show_reminder(self, title: str) -> None:
        QMessageBox.information(self, "JARVIS reminder", title)
