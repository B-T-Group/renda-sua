from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemCategory(BaseModel):
    created_at: datetime.datetime
    description: str
    id: int
    name: str
    status: str
    updated_at: datetime.datetime
