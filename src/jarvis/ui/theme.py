"""Single source of truth for JARVIS's dark glass-inspired visual language."""

APP_STYLE = """
* { font-family: 'Segoe UI', sans-serif; font-size: 14px; color: #e8f1ff; }
QMainWindow, QWidget#root { background: #07111f; }
QFrame#sidebar { background: #0b1a2c; border-right: 1px solid #1d4060; }
QFrame#card { background: #0e2135; border: 1px solid #1d4868; border-radius: 14px; }
QLabel#brand { color: #72e8ff; font-size: 27px; font-weight: 700; letter-spacing: 4px; }
QLabel#eyebrow { color: #6f9cb8; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; }
QLabel#title { color: #f4f9ff; font-size: 25px; font-weight: 650; }
QPushButton { background: #123756; border: 1px solid #29739c; border-radius: 9px; padding: 9px 13px; font-weight: 600; }
QPushButton:hover { background: #18517a; border-color: #66d4f0; }
QPushButton:pressed { background: #0b2a43; }
QPushButton#nav { text-align: left; background: transparent; border: 0; border-radius: 8px; padding: 10px; color: #a9c7dc; }
QPushButton#nav:hover, QPushButton#nav:checked { background: #123956; color: #86ebff; }
QPushButton#mic { border-radius: 30px; min-width: 60px; min-height: 60px; background: #0b5c79; border: 2px solid #70ebff; font-size: 22px; }
QLineEdit, QPlainTextEdit, QTextBrowser, QComboBox, QSpinBox { background: #081827; border: 1px solid #27506c; border-radius: 8px; padding: 8px; selection-background-color: #17628a; }
QLineEdit:focus, QPlainTextEdit:focus, QComboBox:focus { border-color: #6be5ff; }
QTextBrowser { border: 0; background: transparent; }
QListWidget { background: #081827; border: 1px solid #27506c; border-radius: 8px; padding: 5px; }
QScrollBar:vertical { background: transparent; width: 10px; } QScrollBar::handle:vertical { background: #28516a; border-radius: 5px; }
"""
