from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessesMaxField, BusinessesMinField

class BusinessesAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[BusinessesMaxField] | None = None
    min: Optional[BusinessesMinField] | None = None
