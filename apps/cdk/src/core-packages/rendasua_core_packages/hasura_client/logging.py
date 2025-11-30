"""Logging utilities for Hasura client operations."""


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] [hasura_client] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] [hasura_client] {message}" + (f" | {context_str}" if context_str else "") + error_str)

