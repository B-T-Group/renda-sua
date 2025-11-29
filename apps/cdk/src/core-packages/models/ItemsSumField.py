from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemsSumField(BaseModel):
    estimated_delivery_time: Optional[int] | None = None
    item_sub_category_id: Optional[int] | None = None
    max_delivery_distance: Optional[int] | None = None
    max_order_quantity: Optional[int] | None = None
    min_order_quantity: Optional[int] | None = None
    price: Optional[float] | None = None
    weight: Optional[float] | None = None
