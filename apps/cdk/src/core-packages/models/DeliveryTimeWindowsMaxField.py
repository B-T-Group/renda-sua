from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class DeliveryTimeWindowsMaxField(BaseModel):
    confirmed_at: Optional[datetime.datetime] | None = None
    confirmed_by: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    order_id: Optional[str] | None = None
    preferred_date: Optional[datetime.date] | None = None
    slot_id: Optional[str] | None = None
    special_instructions: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
