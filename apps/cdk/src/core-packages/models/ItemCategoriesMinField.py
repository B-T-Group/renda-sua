from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemCategoriesMinField(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    description: Optional[str] | None = None
    id: Optional[int] | None = None
    name: Optional[str] | None = None
    status: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
