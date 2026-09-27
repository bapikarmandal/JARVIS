"""Persistent reminder service; UI controls polling and notification delivery."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from jarvis.storage.database import Database


class ReminderService:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create_in(self, title: str, minutes: int) -> int:
        if not title.strip() or minutes < 1:
            raise ValueError("A reminder needs a title and at least one minute.")
        return self.database.add_reminder(
            title.strip(), datetime.now(UTC) + timedelta(minutes=minutes)
        )

    def deliver_due(self, notify: Callable[[str], None]) -> int:
        due = self.database.due_reminders(datetime.now(UTC))
        for item in due:
            notify(str(item["title"]))
            self.database.complete_reminder(int(item["id"]))
        return len(due)
