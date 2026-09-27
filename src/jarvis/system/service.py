"""Narrow system actions; dangerous operations only request confirmation here."""

import platform
import subprocess
import webbrowser
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

from jarvis.core.errors import CapabilityUnavailable
from jarvis.core.models import ConfirmationRequest, RiskLevel
from jarvis.core.safety import SafetyGate


class SystemService:
    def __init__(self, data_directory: Path, safety: SafetyGate) -> None:
        self.data_directory, self.safety = data_directory, safety

    def open_url(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Only complete http(s) URLs can be opened.")
        return webbrowser.open(url, new=2)

    def take_screenshot(self) -> Path:
        try:
            from PIL import ImageGrab
        except ImportError as error:
            raise CapabilityUnavailable(
                "Install JARVIS with the 'vision' extra to capture screenshots."
            ) from error
        destination = self.data_directory / "screenshots"
        destination.mkdir(parents=True, exist_ok=True)
        filename = destination / f"jarvis-{datetime.now(UTC):%Y%m%dT%H%M%SZ}.png"
        try:
            ImageGrab.grab().save(filename)
        except OSError as error:
            raise CapabilityUnavailable(
                "Screenshot capture is unavailable in this desktop session."
            ) from error
        return filename

    def request_power_action(self, action: str) -> ConfirmationRequest:
        if action not in {"lock", "sleep", "restart", "shutdown"}:
            raise ValueError(f"Unsupported power action: {action}")
        return self.safety.require(action, f"{action.title()} this computer", RiskLevel.DANGEROUS)  # type: ignore[return-value]

    def execute_power_action(self, action: str, confirmation_token: UUID) -> None:
        """Run a power command only after a one-time token from the visible confirmation UI."""
        if platform.system() != "Windows":
            raise CapabilityUnavailable(
                "Power controls are currently implemented for Windows only."
            )
        commands = {
            "lock": ["rundll32.exe", "user32.dll,LockWorkStation"],
            "sleep": ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"],
            "restart": ["shutdown.exe", "/r", "/t", "0"],
            "shutdown": ["shutdown.exe", "/s", "/t", "0"],
        }
        if action not in commands:
            raise ValueError(f"Unsupported power action: {action}")

        def run() -> None:
            subprocess.Popen(commands[action], close_fds=True)

        self.safety.execute_after_confirmation(confirmation_token, run)

    def system_summary(self) -> dict[str, str]:
        return {"platform": platform.platform(), "python": platform.python_version()}
