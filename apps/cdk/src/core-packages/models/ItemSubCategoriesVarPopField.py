from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemSubCategoriesVarPopField(BaseModel):
    id: Optional[float] | None = None
    item_category_id: Optional[float] | None = None
