from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class DeliveryTimeSlot(BaseModel):
    country_code: str
    created_at: Optional[datetime.datetime] | None = None
    display_order: Optional[int] | None = None
    end_time: datetime.time
    id: str
    is_active: Optional[bool] | None = None
    max_orders_per_slot: Optional[int] | None = None
    slot_name: str
    slot_type: str
    start_time: datetime.time
    state: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
