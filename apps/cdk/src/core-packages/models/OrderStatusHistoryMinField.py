from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrderStatusHistoryMinField(BaseModel):
    changed_by_type: Optional[str] | None = None
    changed_by_user_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    location_address: Optional[str] | None = None
    location_lat: Optional[float] | None = None
    location_lng: Optional[float] | None = None
    notes: Optional[str] | None = None
    order_id: Optional[str] | None = None
    previous_status: Optional[str] | None = None
    status: Optional[str] | None = None
