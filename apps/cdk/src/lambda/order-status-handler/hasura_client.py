"""Hasura GraphQL client and queries."""
import os
import requests
from typing import Optional, List, Dict
from models import Order, BusinessLocation, Address, AgentLocation, Coordinates
from geocoding import geocode_address, persist_coordinates_to_hasura
from secrets_manager import get_hasura_admin_secret, get_google_maps_api_key


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] [hasura_client] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] [hasura_client] {message}" + (f" | {context_str}" if context_str else "") + error_str)


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
    
    log_info("Fetching order from Hasura", order_id=order_id)
    
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
            log_error("Hasura query error", order_id=order_id, errors=result['errors'])
            return None
        
        order_data = result.get("data", {}).get("orders_by_pk")
        if not order_data:
            log_error("Order not found in Hasura", order_id=order_id)
            return None
        
        log_info("Order fetched successfully", order_id=order_id)
        
        # Parse business location and address
        business_location_data = order_data.get("business_location")
        if not business_location_data:
            log_error("Business location not found for order", order_id=order_id)
            return None
        
        address_data = business_location_data.get("address")
        if not address_data:
            log_error("Address not found for business location", order_id=order_id)
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
        
        log_info(
            "Address parsed from order",
            address_id=address.id,
            has_latitude=address.latitude is not None,
            has_longitude=address.longitude is not None,
        )
        
        # If coordinates are missing, geocode and persist
        if (address.latitude is None or address.longitude is None) and google_maps_api_key:
            log_info("Coordinates missing, starting geocoding", address_id=address.id)
            coordinates = geocode_address(address, google_maps_api_key)
            
            if coordinates:
                log_info(
                    "Geocoding successful",
                    address_id=address.id,
                    latitude=coordinates.latitude,
                    longitude=coordinates.longitude,
                )
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
                log_error("Failed to geocode address", address_id=address.id)
        
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
        
        log_info(
            "Order object created successfully",
            order_id=order.id,
            order_number=order.order_number,
            business_location=order.business_location.name,
        )
        
        return order
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching order from Hasura", error=e, order_id=order_id)
        return None
    except Exception as e:
        log_error("Unexpected error fetching order", error=e, order_id=order_id)
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
    
    log_info("Fetching all agent locations from Hasura")
    
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
            log_error("Hasura query error when fetching agent locations", errors=result['errors'])
            return []
        
        agent_locations_data = result.get("data", {}).get("agent_locations", [])
        
        log_info("Agent locations fetched from Hasura", count=len(agent_locations_data))
        
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
        
        log_info("Agent locations parsed successfully", count=len(agent_locations))
        
        return agent_locations
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching agent locations from Hasura", error=e)
        return []
    except Exception as e:
        log_error("Unexpected error fetching agent locations", error=e)
        return []

