from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class DeliveryTimeSlotsVarSampField(BaseModel):
    display_order: Optional[float] | None = None
    max_orders_per_slot: Optional[float] | None = None
