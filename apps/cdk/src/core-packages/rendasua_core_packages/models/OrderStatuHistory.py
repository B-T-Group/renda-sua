from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Order, User

class OrderStatuHistory(BaseModel):
    changed_by_type: str
    changed_by_user: Optional[User] | None = None
    changed_by_user_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: str
    location_address: Optional[str] | None = None
    location_lat: Optional[float] | None = None
    location_lng: Optional[float] | None = None
    notes: Optional[str] | None = None
    order: Optional[Order] | None = None
    order_id: str
    previous_status: Optional[str] | None = None
    status: str
