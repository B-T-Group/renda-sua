from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import PaymentCallbacksMaxField, PaymentCallbacksMinField

class PaymentCallbacksAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[PaymentCallbacksMaxField] | None = None
    min: Optional[PaymentCallbacksMinField] | None = None
