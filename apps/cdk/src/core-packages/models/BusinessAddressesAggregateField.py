from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessAddressesMaxField, BusinessAddressesMinField

class BusinessAddressesAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[BusinessAddressesMaxField] | None = None
    min: Optional[BusinessAddressesMinField] | None = None
