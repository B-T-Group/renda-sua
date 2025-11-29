from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessLocation

class Addresse(BaseModel):
    address_line_1: Optional[str] | None = None
    address_line_2: Optional[str] | None = None
    address_type: Optional[str] | None = None
    business_location: Optional[BusinessLocation] | None = None
    city: Optional[str] | None = None
    country: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    is_primary: Optional[bool] | None = None
    latitude: Optional[float] | None = None
    longitude: Optional[float] | None = None
    postal_code: Optional[str] | None = None
    state: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
