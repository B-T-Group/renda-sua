from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Address, Business

class BusinessLocation(BaseModel):
    address: Optional[Address] | None = None
    address_id: str
    business: Optional[Business] | None = None
    business_id: str
    created_at: datetime.datetime
    email: Optional[str] | None = None
    id: str
    is_active: Optional[bool] | None = None
    is_primary: Optional[bool] | None = None
    location_type: Optional[str] | None = None
    name: str
    operating_hours: Optional[str] | None = None
    phone: Optional[str] | None = None
    updated_at: datetime.datetime
