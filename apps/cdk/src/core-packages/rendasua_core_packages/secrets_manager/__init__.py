"""
Shared AWS Secrets Manager helpers.

These functions are extracted from the order-status Lambda so they can
be reused by other functions via the core-packages Lambda layer.
"""

from .client import (
    get_secret,
    get_hasura_admin_secret,
    get_google_maps_api_key,
    get_sendgrid_api_key,
)

__all__ = [
    "get_secret",
    "get_hasura_admin_secret",
    "get_google_maps_api_key",
    "get_sendgrid_api_key",
]


