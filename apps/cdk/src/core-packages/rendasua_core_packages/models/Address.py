from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessLocation

class Address(BaseModel):
    address_line_1: str
    address_line_2: Optional[str] | None = None
    address_type: Optional[str] | None = None
    business_location: Optional[BusinessLocation] | None = None
    city: str
    country: str
    created_at: Optional[datetime.datetime] | None = None
    id: str
    is_primary: Optional[bool] | None = None
    latitude: Optional[float] | None = None
    longitude: Optional[float] | None = None
    postal_code: str
    state: str
    updated_at: Optional[datetime.datetime] | None = None
