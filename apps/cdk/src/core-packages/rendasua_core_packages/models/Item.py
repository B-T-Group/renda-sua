from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Brand, Business, ItemSubCategory

class Item(BaseModel):
    brand: Optional[Brand] | None = None
    brand_id: Optional[str] | None = None
    business: Optional[Business] | None = None
    business_id: Optional[str] | None = None
    color: Optional[str] | None = None
    created_at: datetime.datetime
    currency: str
    description: str
    estimated_delivery_time: Optional[int] | None = None
    id: str
    is_active: Optional[bool] | None = None
    is_fragile: Optional[bool] | None = None
    is_perishable: Optional[bool] | None = None
    item_sub_category: Optional[ItemSubCategory] | None = None
    item_sub_category_id: int
    max_delivery_distance: Optional[int] | None = None
    max_order_quantity: Optional[int] | None = None
    min_order_quantity: Optional[int] | None = None
    model: Optional[str] | None = None
    name: str
    price: float
    requires_special_handling: Optional[bool] | None = None
    sku: Optional[str] | None = None
    updated_at: datetime.datetime
    weight: Optional[float] | None = None
    weight_unit: Optional[str] | None = None
