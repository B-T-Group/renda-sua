"""Hasura GraphQL client and queries."""
import os
import requests
from typing import Optional, List, Dict
from models import Order, BusinessLocation, Address, AgentLocation, Coordinates
from geocoding import geocode_address, persist_coordinates_to_hasura
from secrets_manager import get_hasura_admin_secret, get_google_maps_api_key


def get_order_with_location(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    google_maps_api_key: Optional[str] = None
) -> Optional[Order]:
    """
    Fetch order with business location and address.
    If coordinates are missing, geocode and persist them.
    
    Args:
        order_id: Order ID to fetch
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        google_maps_api_key: Google Maps API key for geocoding
        
    Returns:
        Order object if found, None otherwise
    """
    query = """
    query GetOrderWithLocation($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        id
        order_number
        business_location {
          id
          name
          address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            latitude
            longitude
          }
        }
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {"orderId": order_id},
    }
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            print(f"Hasura query error: {result['errors']}")
            return None
        
        order_data = result.get("data", {}).get("orders_by_pk")
        if not order_data:
            print(f"Order {order_id} not found")
            return None
        
        # Parse business location and address
        business_location_data = order_data.get("business_location")
        if not business_location_data:
            print(f"Business location not found for order {order_id}")
            return None
        
        address_data = business_location_data.get("address")
        if not address_data:
            print(f"Address not found for business location")
            return None
        
        # Create address object
        address = Address(
            id=address_data["id"],
            address_line_1=address_data["address_line_1"],
            address_line_2=address_data.get("address_line_2"),
            city=address_data["city"],
            state=address_data["state"],
            postal_code=address_data.get("postal_code"),
            country=address_data["country"],
            latitude=address_data.get("latitude"),
            longitude=address_data.get("longitude"),
        )
        
        # If coordinates are missing, geocode and persist
        if (address.latitude is None or address.longitude is None) and google_maps_api_key:
            print(f"Coordinates missing for address {address.id}, geocoding...")
            coordinates = geocode_address(address, google_maps_api_key)
            
            if coordinates:
                # Update address object with new coordinates
                address.latitude = coordinates.latitude
                address.longitude = coordinates.longitude
                
                # Persist to Hasura
                persist_coordinates_to_hasura(
                    address.id,
                    coordinates,
                    hasura_endpoint,
                    hasura_admin_secret
                )
            else:
                print(f"Failed to geocode address {address.id}")
        
        business_location = BusinessLocation(
            id=business_location_data["id"],
            name=business_location_data.get("name", ""),
            address=address,
        )
        
        order = Order(
            id=order_data["id"],
            order_number=order_data["order_number"],
            business_location=business_location,
        )
        
        return order
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching order from Hasura: {str(e)}")
        return None
    except Exception as e:
        print(f"Unexpected error fetching order: {str(e)}")
        return None


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
        agent_id
        latitude
        longitude
        created_at
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
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {},
    }
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            print(f"Hasura query error: {result['errors']}")
            return []
        
        agent_locations_data = result.get("data", {}).get("agent_locations", [])
        
        # Each agent has one location entry, so no deduplication needed
        agent_locations = []
        
        for loc_data in agent_locations_data:
            agent_location = AgentLocation(
                agent_id=loc_data["agent_id"],
                latitude=float(loc_data["latitude"]),
                longitude=float(loc_data["longitude"]),
                created_at=loc_data["created_at"],
                agent=loc_data.get("agent", {}),
            )
            agent_locations.append(agent_location)
        
        return agent_locations
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching agent locations from Hasura: {str(e)}")
        return []
    except Exception as e:
        print(f"Unexpected error fetching agent locations: {str(e)}")
        return []

