"""OS-keyring backed secret storage."""

import keyring
from keyring.errors import KeyringError

from jarvis.core.errors import JarvisError


class SecretStore:
    """Stores provider credentials outside the SQLite application database."""

    SERVICE_NAME = "jarvis-desktop"

    def get(self, name: str) -> str | None:
        try:
            return keyring.get_password(self.SERVICE_NAME, name)
        except KeyringError as error:
            raise JarvisError("The operating-system credential store is unavailable.") from error

    def set(self, name: str, value: str) -> None:
        try:
            keyring.set_password(self.SERVICE_NAME, name, value)
        except KeyringError as error:
            raise JarvisError(
                "Could not save the credential in the operating-system keyring."
            ) from error
