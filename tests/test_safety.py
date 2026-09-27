import pytest

from jarvis.core.errors import ConfirmationRequired
from jarvis.core.models import RiskLevel
from jarvis.core.safety import SafetyGate


def test_sensitive_action_requires_one_time_confirmation() -> None:
    gate = SafetyGate()
    request = gate.require("shutdown", "Shutdown this computer", RiskLevel.DANGEROUS)
    assert request is not None
    completed: list[bool] = []
    gate.execute_after_confirmation(request.token, lambda: completed.append(True))
    assert completed == [True]
    with pytest.raises(ConfirmationRequired):
        gate.execute_after_confirmation(request.token, lambda: None)
