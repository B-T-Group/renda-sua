"""Haversine distance calculation utilities."""
import math
from typing import Tuple


def to_radians(degrees: float) -> float:
    """
    Convert degrees to radians.
    
    Args:
        degrees: Angle in degrees
        
    Returns:
        Angle in radians
    """
    return degrees * math.pi / 180


def calculate_haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate distance between two coordinates using Haversine formula.
    
    Args:
        lat1: Latitude of first point
        lon1: Longitude of first point
        lat2: Latitude of second point
        lon2: Longitude of second point
        
    Returns:
        Distance in kilometers
    """
    # Earth radius in kilometers
    R = 6371
    
    # Convert to radians
    lat1_rad = to_radians(lat1)
    lat2_rad = to_radians(lat2)
    dlat_rad = to_radians(lat2 - lat1)
    dlon_rad = to_radians(lon2 - lon1)
    
    # Haversine formula
    a = (
        math.sin(dlat_rad / 2) ** 2 +
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon_rad / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance


def format_distance(distance_km: float) -> str:
    """
    Format distance for display.
    
    Args:
        distance_km: Distance in kilometers
        
    Returns:
        Formatted distance string (e.g., "2.5 km" or "0.8 km")
    """
    if distance_km < 1:
        return f"{distance_km * 1000:.0f} m"
    return f"{distance_km:.1f} km"

