from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Addresse, Businesse

class BusinessLocation(BaseModel):
    address: Optional[Addresse] | None = None
    address_id: Optional[str] | None = None
    business: Optional[Businesse] | None = None
    business_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    email: Optional[str] | None = None
    id: Optional[str] | None = None
    is_active: Optional[bool] | None = None
    is_primary: Optional[bool] | None = None
    location_type: Optional[str] | None = None
    name: Optional[str] | None = None
    operating_hours: Optional[str] | None = None
    phone: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
