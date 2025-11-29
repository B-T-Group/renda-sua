"""
Location-related Hasura operations.
"""

from typing import Any, Dict, List

from .base import HasuraClient


def get_all_agent_locations(client: HasuraClient) -> List[Dict[str, Any]]:
    query = """
    query GetAgentLocations {
      agent_locations {
        agent_id
        latitude
        longitude
        created_at
      }
    }
    """
    data = client.execute(query)
    return data.get("agent_locations") or []


