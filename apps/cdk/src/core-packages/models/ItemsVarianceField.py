from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemsVarianceField(BaseModel):
    estimated_delivery_time: Optional[float] | None = None
    item_sub_category_id: Optional[float] | None = None
    max_delivery_distance: Optional[float] | None = None
    max_order_quantity: Optional[float] | None = None
    min_order_quantity: Optional[float] | None = None
    price: Optional[float] | None = None
    weight: Optional[float] | None = None
