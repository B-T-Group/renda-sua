"""
Datetime utility functions for parsing and formatting datetime strings.
"""

from typing import Optional
import datetime


def parse_datetime(dt_str: Optional[str]) -> datetime.datetime:
    """
    Parse datetime string to datetime object.
    
    Args:
        dt_str: Optional datetime string to parse
        
    Returns:
        datetime.datetime object. Returns current time if dt_str is None or parsing fails.
    """
    if not dt_str:
        return datetime.datetime.now()
    try:
        return datetime.datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except:
        return datetime.datetime.now()

