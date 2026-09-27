"""Application entry point."""

import sys

from PySide6.QtWidgets import QApplication

from jarvis.app import JarvisApplication
from jarvis.ui.theme import APP_STYLE


def main() -> int:
    """Start the JARVIS desktop application."""
    qt_app = QApplication(sys.argv)
    qt_app.setApplicationName("JARVIS")
    qt_app.setOrganizationName("JARVIS")
    qt_app.setStyleSheet(APP_STYLE)
    application = JarvisApplication(qt_app)
    application.show()
    return qt_app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
