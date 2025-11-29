"""
Lightweight Hasura GraphQL client used by Lambda functions.

The client is intentionally minimal: it knows how to execute parametrised
queries and mutations with the correct admin secret and exposes a small
set of helpers that higher-level domain services can build on.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import os
import requests


@dataclass
class HasuraClientConfig:
    endpoint: str
    admin_secret: str


class HasuraClient:
    def __init__(self, config: HasuraClientConfig) -> None:
        self._config = config

    @classmethod
    def from_env(cls) -> "HasuraClient":
        endpoint = os.environ.get("GRAPHQL_ENDPOINT", "")
        admin_secret = os.environ.get("HASURA_GRAPHQL_ADMIN_SECRET", "")
        return cls(HasuraClientConfig(endpoint=endpoint, admin_secret=admin_secret))

    def execute(
        self,
        query: str,
        variables: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = {"query": query, "variables": variables or {}}
        headers = {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": self._config.admin_secret,
        }
        response = requests.post(
            self._config.endpoint,
            json=payload,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            raise RuntimeError(f"Hasura error: {data['errors']}")
        return data.get("data", {})


