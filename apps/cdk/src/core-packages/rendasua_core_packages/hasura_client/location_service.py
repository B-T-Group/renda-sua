"""
Location-related Hasura operations.
"""

from typing import List, Optional
import datetime
from rendasua_core_packages.models import AgentLocation, Agent, User
from rendasua_core_packages.utilities import parse_datetime
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


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
          user_id
          created_at
          updated_at
          user {
            id
            email
            first_name
            last_name
            identifier
            created_at
            updated_at
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
            # Construct Pydantic models for nested relations
            agent_model = None
            agent_data = loc_data.get("agent")
            
            if agent_data:
                # Construct User model from nested user relation
                user_model = None
                user_data = agent_data.get("user")
                
                if user_data:
                    user_model = User.model_construct(
                        id=user_data["id"],
                        email=user_data["email"],
                        first_name=user_data["first_name"],
                        last_name=user_data["last_name"],
                        identifier=user_data["identifier"],
                        created_at=parse_datetime(user_data.get("created_at")),
                        updated_at=parse_datetime(user_data.get("updated_at")),
                    )
                
                # Construct Agent model with nested User
                agent_model = Agent.model_construct(
                    id=agent_data["id"],
                    user_id=agent_data["user_id"],
                    created_at=parse_datetime(agent_data.get("created_at")),
                    updated_at=parse_datetime(agent_data.get("updated_at")),
                    user=user_model,
                )
            
            # Create AgentLocation with populated agent relation
            agent_location = AgentLocation(
                id=loc_data.get("id", ""),
                agent_id=loc_data["agent_id"],
                latitude=float(loc_data["latitude"]),
                longitude=float(loc_data["longitude"]),
                created_at=parse_datetime(loc_data.get("created_at")),
                updated_at=parse_datetime(loc_data.get("updated_at")),
                agent=agent_model,
            )
            agent_locations.append(agent_location)
        
        log_info("Agent locations parsed successfully", count=len(agent_locations))
        
        return agent_locations
        
    except Exception as e:
        log_error("Error fetching agent locations", error=e)
        return []


