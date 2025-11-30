"""
AWS Secrets Manager helper functions used across Lambdas.

This module centralises secret retrieval so that all functions share
the same logging and error-handling behaviour.
"""

from typing import Dict, Optional

import boto3
import json


def _format_context(**kwargs) -> str:
    parts = [f"{key}={value}" for key, value in kwargs.items()]
    return " ".join(parts)


def _log_info(message: str, **kwargs) -> None:
    context = _format_context(**kwargs)
    suffix = f" | {context}" if context else ""
    print(f"[INFO] [secrets_manager] {message}{suffix}")


def _log_error(message: str, error: Exception | None = None, **kwargs) -> None:
    context = _format_context(**kwargs)
    error_str = f" | error={error}" if error else ""
    suffix = "".join([f" | {context}" if context else "", error_str])
    print(f"[ERROR] [secrets_manager] {message}{suffix}")


def get_secret(secret_name: str) -> Dict[str, str]:
    _log_info("Retrieving secret from Secrets Manager", secret_name=secret_name)
    client = boto3.client("secretsmanager")
    try:
        response = client.get_secret_value(SecretId=secret_name)
        if "SecretString" not in response:
            _log_error("Secret does not contain SecretString", secret_name=secret_name)
            raise ValueError(f"Secret {secret_name} does not contain SecretString")
        secrets = json.loads(response["SecretString"])
        _log_info(
            "Secret retrieved successfully",
            secret_name=secret_name,
            keys=list(secrets.keys()),
        )
        return secrets
    except Exception as exc:  # noqa: BLE001
        _log_error("Failed to retrieve secret", error=exc, secret_name=secret_name)
        raise


def get_hasura_admin_secret(environment: str) -> str:
    secret_name = f"{environment}-rendasua-backend-secrets"
    secrets = get_secret(secret_name)
    return secrets.get("HASURA_GRAPHQL_ADMIN_SECRET", "")


def get_google_maps_api_key(environment: str) -> Optional[str]:
    secret_name = f"{environment}-rendasua-backend-secrets"
    secrets = get_secret(secret_name)
    return secrets.get("GOOGLE_MAPS_API_KEY")


def get_sendgrid_api_key(environment: str) -> Optional[str]:
    _log_info("Retrieving SendGrid API key", environment=environment)
    try:
        secret_name = f"{environment}-rendasua-backend-secrets"
        secrets = get_secret(secret_name)
        api_key = secrets.get("SENDGRID_API_KEY")
        if not api_key:
            _log_error(
                "SendGrid API key not found in secrets",
                environment=environment,
                secret_name=secret_name,
            )
            _log_info("Available secret keys", keys=list(secrets.keys())[:10])
            return None
        preview = api_key[:8] + "..." if len(api_key) > 8 else "***"
        _log_info("SendGrid API key retrieved successfully", key_preview=preview)
        return api_key
    except Exception as exc:  # noqa: BLE001
        _log_error(
            "Failed to retrieve SendGrid API key",
            error=exc,
            environment=environment,
        )
        return None


