from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import ItemCategory

class ItemSubCategory(BaseModel):
    created_at: datetime.datetime
    description: str
    id: int
    item_category: Optional[ItemCategory] | None = None
    item_category_id: int
    name: str
    status: str
    updated_at: datetime.datetime
