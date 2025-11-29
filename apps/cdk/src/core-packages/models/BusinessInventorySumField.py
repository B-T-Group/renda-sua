from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class BusinessInventorySumField(BaseModel):
    computed_available_quantity: Optional[int] | None = None
    quantity: Optional[int] | None = None
    reorder_point: Optional[int] | None = None
    reorder_quantity: Optional[int] | None = None
    reserved_quantity: Optional[int] | None = None
    selling_price: Optional[float] | None = None
    unit_cost: Optional[float] | None = None
