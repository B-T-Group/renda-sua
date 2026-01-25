from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessInventory, Item, Order

class OrderItem(BaseModel):
    business_inventory: Optional[BusinessInventory] | None = None
    business_inventory_id: str
    created_at: Optional[datetime.datetime] | None = None
    id: str
    item: Optional[Item] | None = None
    item_description: Optional[str] | None = None
    item_id: str
    item_name: str
    order: Optional[Order] | None = None
    order_id: str
    quantity: int
    special_instructions: Optional[str] | None = None
    total_price: float
    unit_price: float
    updated_at: Optional[datetime.datetime] | None = None
