import threading

from jarvis.voice.service import VoiceService


class FakeEngine:
    def __init__(self) -> None:
        self.spoken: list[str] = []
        self.finished = threading.Event()

    def say(self, text: str) -> None:
        self.spoken.append(text)

    def runAndWait(self) -> None:
        if len(self.spoken) == 2:
            self.finished.set()


class FakePyttsx3:
    def __init__(self, engine: FakeEngine) -> None:
        self.engine = engine

    def init(self) -> FakeEngine:
        return self.engine


def test_speech_requests_share_one_serialized_engine(monkeypatch: object) -> None:
    engine = FakeEngine()
    module = FakePyttsx3(engine)
    monkeypatch.setitem(__import__("sys").modules, "pyttsx3", module)
    service = VoiceService()

    service.speak("First")
    service.speak("Second")

    assert engine.finished.wait(timeout=1)
    assert engine.spoken == ["First", "Second"]
