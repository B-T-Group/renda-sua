from __future__ import annotations
from pydantic import BaseModel


class Coordinates(BaseModel):
    """Geographic coordinates."""
    latitude: float
    longitude: float

