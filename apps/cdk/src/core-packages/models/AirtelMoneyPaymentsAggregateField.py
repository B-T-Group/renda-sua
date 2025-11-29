from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AirtelMoneyPaymentsMaxField, AirtelMoneyPaymentsMinField

class AirtelMoneyPaymentsAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[AirtelMoneyPaymentsMaxField] | None = None
    min: Optional[AirtelMoneyPaymentsMinField] | None = None
