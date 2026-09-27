"""Memory service separating stored facts from short-term chat context."""

from dataclasses import dataclass

from jarvis.storage.database import Database


@dataclass(frozen=True, slots=True)
class Memory:
    id: int
    category: str
    content: str
    importance: int
    created_at: str


class MemoryService:
    """Stores explicit facts and retrieves relevant facts with transparent keyword ranking."""

    def __init__(self, database: Database) -> None:
        self.database = database

    def remember(self, content: str, category: str = "fact", importance: int = 1) -> Memory:
        cleaned = content.strip()
        if not cleaned:
            raise ValueError("Memory content cannot be empty.")
        memory_id = self.database.add_memory(category, cleaned, importance)
        return Memory(memory_id, category, cleaned, importance, "")

    def search(self, query: str) -> list[Memory]:
        rows = (
            self.database.list_memories()
            if not query.strip()
            else self.database.search_memories(query)
        )
        return [
            Memory(
                int(row["id"]),
                row["category"],
                row["content"],
                int(row["importance"]),
                row["created_at"],
            )
            for row in rows
        ]

    def forget(self, memory_id: int) -> None:
        self.database.delete_memory(memory_id)
