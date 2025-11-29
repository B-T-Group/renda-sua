"""
User-related Hasura operations.
"""

from typing import Any, Dict, Optional

from .base import HasuraClient


def get_user_by_id(client: HasuraClient, user_id: str) -> Optional[Dict[str, Any]]:
    query = """
    query GetUserById($userId: uuid!) {
      users_by_pk(id: $userId) {
        id
        email
        first_name
        last_name
      }
    }
    """
    data = client.execute(query, {"userId": user_id})
    return data.get("users_by_pk")


