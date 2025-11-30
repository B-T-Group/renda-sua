"""
Location-related Hasura operations.
"""

from typing import List, Optional
import datetime
from rendasua_core_packages.models import AgentLocation
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


def parse_datetime(dt_str: Optional[str]) -> datetime.datetime:
    """Parse datetime string to datetime object."""
    if not dt_str:
        return datetime.datetime.now()
    try:
        return datetime.datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except:
        return datetime.datetime.now()


def get_all_agent_locations(
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> List[AgentLocation]:
    """
    Fetch all agent locations with latest location per agent.
    
    Args:
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        List of AgentLocation objects
    """
    query = """
    query GetAgentLocations {
      agent_locations {
        id
        agent_id
        latitude
        longitude
        created_at
        updated_at
        agent {
          id
          user {
            email
            first_name
            last_name
          }
        }
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching all agent locations from Hasura")
    
    try:
        data = client.execute(query, {})
        agent_locations_data = data.get("agent_locations", [])
        
        log_info("Agent locations fetched from Hasura", count=len(agent_locations_data))
        
        # Each agent has one location entry, so no deduplication needed
        agent_locations = []
        
        for loc_data in agent_locations_data:
            agent_location = AgentLocation(
                id=loc_data.get("id", ""),
                agent_id=loc_data["agent_id"],
                latitude=float(loc_data["latitude"]),
                longitude=float(loc_data["longitude"]),
                created_at=parse_datetime(loc_data.get("created_at")),
                updated_at=parse_datetime(loc_data.get("updated_at")),
            )
            agent_locations.append(agent_location)
        
        log_info("Agent locations parsed successfully", count=len(agent_locations))
        
        return agent_locations
        
    except Exception as e:
        log_error("Error fetching agent locations", error=e)
        return []


