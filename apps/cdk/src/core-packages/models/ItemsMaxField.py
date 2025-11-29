from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemsMaxField(BaseModel):
    brand_id: Optional[str] | None = None
    business_id: Optional[str] | None = None
    color: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    description: Optional[str] | None = None
    estimated_delivery_time: Optional[int] | None = None
    id: Optional[str] | None = None
    item_sub_category_id: Optional[int] | None = None
    max_delivery_distance: Optional[int] | None = None
    max_order_quantity: Optional[int] | None = None
    min_order_quantity: Optional[int] | None = None
    model: Optional[str] | None = None
    name: Optional[str] | None = None
    price: Optional[float] | None = None
    sku: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    weight: Optional[float] | None = None
    weight_unit: Optional[str] | None = None
