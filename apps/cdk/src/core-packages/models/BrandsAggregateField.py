from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BrandsMaxField, BrandsMinField

class BrandsAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[BrandsMaxField] | None = None
    min: Optional[BrandsMinField] | None = None
