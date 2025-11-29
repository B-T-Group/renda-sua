from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class GoogleDistanceCacheMaxField(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    destination_address_formatted: Optional[str] | None = None
    destination_address_id: Optional[str] | None = None
    distance_text: Optional[str] | None = None
    distance_value: Optional[int] | None = None
    duration_text: Optional[str] | None = None
    duration_value: Optional[int] | None = None
    expires_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    origin_address_formatted: Optional[str] | None = None
    origin_address_id: Optional[str] | None = None
    status: Optional[str] | None = None
