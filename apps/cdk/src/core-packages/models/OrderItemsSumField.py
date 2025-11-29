from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrderItemsSumField(BaseModel):
    quantity: Optional[int] | None = None
    total_price: Optional[float] | None = None
    unit_price: Optional[float] | None = None
    weight: Optional[float] | None = None
