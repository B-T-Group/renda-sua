from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessLocationsMaxField, BusinessLocationsMinField

class BusinessLocationsAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[BusinessLocationsMaxField] | None = None
    min: Optional[BusinessLocationsMinField] | None = None
