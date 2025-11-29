from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import DeliveryConfigsMaxField, DeliveryConfigsMinField

class DeliveryConfigsAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[DeliveryConfigsMaxField] | None = None
    min: Optional[DeliveryConfigsMinField] | None = None
