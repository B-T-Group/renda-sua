from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class DeliveryTimeSlotsMaxField(BaseModel):
    country_code: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    display_order: Optional[int] | None = None
    id: Optional[str] | None = None
    max_orders_per_slot: Optional[int] | None = None
    slot_name: Optional[str] | None = None
    slot_type: Optional[str] | None = None
    state: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
