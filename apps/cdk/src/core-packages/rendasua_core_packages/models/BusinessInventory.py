from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessLocation, Item

class BusinessInventory(BaseModel):
    business_location: Optional[BusinessLocation] | None = None
    business_location_id: str
    computed_available_quantity: Optional[int] | None = None
    created_at: datetime.datetime
    id: str
    is_active: Optional[bool] | None = None
    item: Optional[Item] | None = None
    item_id: str
    last_restocked_at: Optional[datetime.datetime] | None = None
    quantity: int
    reorder_point: Optional[int] | None = None
    reorder_quantity: Optional[int] | None = None
    reserved_quantity: int
    selling_price: Optional[float] | None = None
    unit_cost: Optional[float] | None = None
    updated_at: datetime.datetime
