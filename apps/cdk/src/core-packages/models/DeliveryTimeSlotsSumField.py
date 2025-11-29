from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class DeliveryTimeSlotsSumField(BaseModel):
    display_order: Optional[int] | None = None
    max_orders_per_slot: Optional[int] | None = None
