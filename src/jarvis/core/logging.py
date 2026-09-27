"""Application logging that avoids leaking secrets."""

import logging
import re
from pathlib import Path


class SecretRedactor(logging.Filter):
    """Redacts common bearer/API-key shapes before they reach a log sink."""

    _patterns = (
        (re.compile(r"(Bearer\s+)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
        (re.compile(r"\b(?:sk-[A-Za-z0-9_-]{8,})\b"), "[REDACTED]"),
        (re.compile(r"\b(?:AIza[A-Za-z0-9_-]{12,})\b"), "[REDACTED]"),
    )

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        for pattern, replacement in self._patterns:
            message = pattern.sub(replacement, message)
        record.msg = message
        record.args = ()
        return True


def configure_logging(log_directory: Path) -> logging.Logger:
    """Configure one file logger for diagnostics outside the UI process."""
    log_directory.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("jarvis")
    logger.setLevel(logging.INFO)
    if logger.handlers:
        return logger
    handler = logging.FileHandler(log_directory / "jarvis.log", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    handler.addFilter(SecretRedactor())
    logger.addHandler(handler)
    return logger
