from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrderItemsMinField(BaseModel):
    business_inventory_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    dimensions: Optional[str] | None = None
    id: Optional[str] | None = None
    item_description: Optional[str] | None = None
    item_id: Optional[str] | None = None
    item_name: Optional[str] | None = None
    order_id: Optional[str] | None = None
    quantity: Optional[int] | None = None
    special_instructions: Optional[str] | None = None
    total_price: Optional[float] | None = None
    unit_price: Optional[float] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    weight: Optional[float] | None = None
    weight_unit: Optional[str] | None = None
