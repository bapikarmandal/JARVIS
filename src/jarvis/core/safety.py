"""Central policy gate for actions with real-world effects."""

from collections.abc import Callable
from uuid import UUID

from jarvis.core.errors import ConfirmationRequired
from jarvis.core.models import ConfirmationRequest, RiskLevel


class SafetyGate:
    """Issues one-time confirmation tokens for actions above the safe risk level."""

    def __init__(self) -> None:
        self._pending: dict[UUID, ConfirmationRequest] = {}

    def require(self, action: str, detail: str, risk: RiskLevel) -> ConfirmationRequest | None:
        if risk is RiskLevel.SAFE:
            return None
        request = ConfirmationRequest.create(action, detail)
        self._pending[request.token] = request
        return request

    def execute_after_confirmation(
        self,
        token: UUID | None,
        callback: Callable[[], None],
    ) -> None:
        if token is None or self._pending.pop(token, None) is None:
            raise ConfirmationRequired("This action requires a fresh confirmation.")
        callback()

    def revoke_all(self) -> None:
        """Invalidate outstanding confirmations when the app is locked or closed."""
        self._pending.clear()
