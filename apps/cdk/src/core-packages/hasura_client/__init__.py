"""
Domain-specific Hasura client helpers.

This package provides a small, shared wrapper around Hasura's GraphQL
API plus service modules that operate on specific domains such as
accounts, locations, and users.
"""

from .base import HasuraClient

__all__ = ["HasuraClient"]


