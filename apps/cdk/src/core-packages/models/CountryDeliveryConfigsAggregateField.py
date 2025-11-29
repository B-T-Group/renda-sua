from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import CountryDeliveryConfigsMaxField, CountryDeliveryConfigsMinField

class CountryDeliveryConfigsAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[CountryDeliveryConfigsMaxField] | None = None
    min: Optional[CountryDeliveryConfigsMinField] | None = None
