from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class BrandsMaxField(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    description: Optional[str] | None = None
    id: Optional[str] | None = None
    name: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
