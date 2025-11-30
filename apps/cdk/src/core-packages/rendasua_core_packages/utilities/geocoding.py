"""Google Maps geocoding service."""
import requests
from typing import Optional
from rendasua_core_packages.models import Address, Coordinates
from rendasua_core_packages.utilities import format_full_address


def geocode_address(address: Address, google_maps_api_key: str) -> Optional[Coordinates]:
    """
    Geocode an address using Google Maps Geocoding API.
    
    Args:
        address: Address object to geocode
        google_maps_api_key: Google Maps API key
        
    Returns:
        Coordinates object if successful, None otherwise
    """
    if not google_maps_api_key:
        print("Google Maps API key not found")
        return None
    
    # Format address string using utility function
    address_string = format_full_address(address)
    
    # Google Maps Geocoding API endpoint
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    
    params = {
        "address": address_string,
        "key": google_maps_api_key,
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("status") != "OK":
            print(f"Geocoding failed: {data.get('status')} - {data.get('error_message', 'Unknown error')}")
            return None
        
        results = data.get("results", [])
        if not results:
            print("No geocoding results returned")
            return None
        
        # Extract coordinates from first result
        location = results[0].get("geometry", {}).get("location", {})
        lat = location.get("lat")
        lng = location.get("lng")
        
        if lat is None or lng is None:
            print("Coordinates not found in geocoding response")
            return None
        
        return Coordinates(latitude=float(lat), longitude=float(lng))
        
    except requests.exceptions.RequestException as e:
        print(f"Error calling Google Maps Geocoding API: {str(e)}")
        return None
    except Exception as e:
        print(f"Unexpected error during geocoding: {str(e)}")
        return None


def persist_coordinates_to_hasura(
    address_id: str,
    coordinates: Coordinates,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> bool:
    """
    Persist coordinates to Hasura address record.
    
    Args:
        address_id: Address ID to update
        coordinates: Coordinates to persist
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        True if successful, False otherwise
    """
    mutation = """
    mutation UpdateAddressCoordinates($addressId: uuid!, $latitude: numeric!, $longitude: numeric!) {
      update_addresses_by_pk(
        pk_columns: { id: $addressId }
        _set: { latitude: $latitude, longitude: $longitude }
      ) {
        id
        latitude
        longitude
      }
    }
    """
    
    variables = {
        "addressId": address_id,
        "latitude": coordinates.latitude,
        "longitude": coordinates.longitude,
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": mutation,
        "variables": variables,
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
            print(f"Hasura mutation error: {result['errors']}")
            return False
        
        print(f"Successfully persisted coordinates for address {address_id}")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Error persisting coordinates to Hasura: {str(e)}")
        return False
    except Exception as e:
        print(f"Unexpected error persisting coordinates: {str(e)}")
        return False

