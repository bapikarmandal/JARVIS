from pathlib import Path

from jarvis.storage.database import Database


def test_settings_and_memory_persist(tmp_path: Path) -> None:
    database = Database(tmp_path / "jarvis.db")
    database.initialize()
    database.set_setting("provider", "ollama")
    database.add_memory("fact", "The user prefers concise replies.")

    assert database.get_setting("provider") == "ollama"
    results = database.search_memories("concise user")
    assert len(results) == 1
    assert results[0]["category"] == "fact"
