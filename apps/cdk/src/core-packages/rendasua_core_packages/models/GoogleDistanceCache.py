from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class GoogleDistanceCache(BaseModel):
    created_at: datetime.datetime
    destination_address_formatted: str
    destination_address_id: str
    distance_text: Optional[str] | None = None
    distance_value: Optional[int] | None = None
    duration_text: Optional[str] | None = None
    duration_value: Optional[int] | None = None
    expires_at: datetime.datetime
    id: str
    origin_address_formatted: str
    origin_address_id: str
    status: str
