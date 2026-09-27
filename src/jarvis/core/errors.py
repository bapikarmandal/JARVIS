"""Domain errors with user-safe messages."""


class JarvisError(Exception):
    """Base error for expected JARVIS failures."""


class ProviderConfigurationError(JarvisError):
    """Raised when an AI provider cannot be used until configured."""


class ProviderResponseError(JarvisError):
    """Raised when a configured provider returns an invalid response."""


class ConfirmationRequired(JarvisError):
    """Raised when a sensitive action has not been explicitly approved."""


class CapabilityUnavailable(JarvisError):
    """Raised when an optional operating-system capability is unavailable."""
