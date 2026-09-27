"""Small SQLite repository with explicit schema initialization."""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from jarvis.core.models import ChatMessage, MessageRole


class Database:
    """Owns JARVIS's local, non-secret durable data."""

    def __init__(self, path: Path) -> None:
        self.path = path

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL,
                    role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY, category TEXT NOT NULL, content TEXT NOT NULL,
                    importance INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reminders (
                    id INTEGER PRIMARY KEY, title TEXT NOT NULL, due_at TEXT NOT NULL,
                    completed_at TEXT, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY, category TEXT NOT NULL, level TEXT NOT NULL,
                    message TEXT NOT NULL, created_at TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat()

    def get_setting(self, key: str, default: str = "") -> str:
        with self.connection() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return default if row is None else str(row["value"])

    def set_setting(self, key: str, value: str) -> None:
        with self.connection() as conn:
            conn.execute(
                """INSERT INTO settings(key, value, updated_at) VALUES(?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                updated_at = excluded.updated_at""",
                (key, value, self._now()),
            )

    def create_conversation(self, title: str = "New conversation") -> int:
        with self.connection() as conn:
            cursor = conn.execute(
                "INSERT INTO conversations(title, created_at) VALUES(?, ?)", (title, self._now())
            )
            return int(cursor.lastrowid)

    def list_conversations(self, limit: int = 50) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return conn.execute(
                "SELECT id, title, created_at FROM conversations ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()

    def set_conversation_title(self, conversation_id: int, title: str) -> None:
        with self.connection() as conn:
            conn.execute(
                "UPDATE conversations SET title = ? WHERE id = ?", (title[:80], conversation_id)
            )

    def add_message(self, conversation_id: int, message: ChatMessage) -> None:
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO messages(conversation_id, role, content, created_at) "
                "VALUES(?, ?, ?, ?)",
                (
                    conversation_id,
                    message.role.value,
                    message.content,
                    message.created_at.isoformat(),
                ),
            )

    def message_count(self, conversation_id: int) -> int:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
        return int(row["count"])

    def messages(self, conversation_id: int, limit: int = 30) -> list[ChatMessage]:
        with self.connection() as conn:
            rows = conn.execute(
                """SELECT role, content, created_at FROM messages WHERE conversation_id = ?
                ORDER BY id DESC LIMIT ?""",
                (conversation_id, limit),
            ).fetchall()
        return [
            ChatMessage(
                MessageRole(row["role"]), row["content"], datetime.fromisoformat(row["created_at"])
            )
            for row in reversed(rows)
        ]

    def clear_conversation(self, conversation_id: int) -> None:
        with self.connection() as conn:
            conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))

    def add_memory(self, category: str, content: str, importance: int = 1) -> int:
        now = self._now()
        with self.connection() as conn:
            cursor = conn.execute(
                """INSERT INTO memories(category, content, importance, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?)""",
                (category, content, importance, now, now),
            )
            return int(cursor.lastrowid)

    def search_memories(self, query: str, limit: int = 25) -> list[sqlite3.Row]:
        words = [word for word in query.lower().split() if len(word) > 1]
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT id, category, content, importance, created_at FROM memories "
                "ORDER BY importance DESC, id DESC"
            ).fetchall()
        ranked = [(sum(word in row["content"].lower() for word in words), row) for row in rows]
        return [
            row
            for score, row in sorted(ranked, key=lambda item: (-item[0], -item[1]["importance"]))
            if score
        ][:limit]

    def list_memories(self, limit: int = 100) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return conn.execute(
                """SELECT id, category, content, importance, created_at FROM memories
                ORDER BY importance DESC, id DESC LIMIT ?""",
                (limit,),
            ).fetchall()

    def delete_memory(self, memory_id: int) -> None:
        with self.connection() as conn:
            conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))

    def add_reminder(self, title: str, due_at: datetime) -> int:
        with self.connection() as conn:
            cursor = conn.execute(
                "INSERT INTO reminders(title, due_at, created_at) VALUES(?, ?, ?)",
                (title, due_at.astimezone(UTC).isoformat(), self._now()),
            )
            return int(cursor.lastrowid)

    def due_reminders(self, now: datetime) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return conn.execute(
                "SELECT id, title, due_at FROM reminders "
                "WHERE completed_at IS NULL AND due_at <= ?",
                (now.astimezone(UTC).isoformat(),),
            ).fetchall()

    def complete_reminder(self, reminder_id: int) -> None:
        with self.connection() as conn:
            conn.execute(
                "UPDATE reminders SET completed_at = ? WHERE id = ?", (self._now(), reminder_id)
            )

    def log(self, category: str, level: str, message: str) -> None:
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO activity_logs(category, level, message, created_at) "
                "VALUES(?, ?, ?, ?)",
                (category, level, message, self._now()),
            )

    def recent_logs(self, limit: int = 200) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return conn.execute(
                "SELECT category, level, message, created_at FROM activity_logs "
                "ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
