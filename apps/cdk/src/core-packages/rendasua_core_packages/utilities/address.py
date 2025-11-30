"""
Address formatting utilities.
"""
from rendasua_core_packages.models import Address


def format_full_address(address: Address) -> str:
    """
    Format a full address string from an Address model.
    
    Handles optional fields (like address_line_2) that may be None.
    Only includes non-empty parts in the final string.
    
    Args:
        address: Address model instance
        
    Returns:
        Formatted address string with all non-empty parts joined by spaces
    """
    address_parts = [
        address.address_line_1,
        address.address_line_2 or "",
        address.city,
        address.state,
        address.country,
        address.postal_code,
    ]
    return " ".join(part for part in address_parts if part)

