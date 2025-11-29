from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import DeliveryTimeSlot, Order, User

class DeliveryTimeWindow(BaseModel):
    confirmedByUser: Optional[User] | None = None
    confirmed_at: Optional[datetime.datetime] | None = None
    confirmed_by: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    is_confirmed: Optional[bool] | None = None
    order: Optional[Order] | None = None
    order_id: Optional[str] | None = None
    preferred_date: Optional[datetime.date] | None = None
    slot: Optional[DeliveryTimeSlot] | None = None
    slot_id: Optional[str] | None = None
    special_instructions: Optional[str] | None = None
    time_slot_end: Optional[datetime.time] | None = None
    time_slot_start: Optional[datetime.time] | None = None
    updated_at: Optional[datetime.datetime] | None = None
