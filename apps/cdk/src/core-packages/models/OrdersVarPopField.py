from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrdersVarPopField(BaseModel):
    base_delivery_fee: Optional[float] | None = None
    per_km_delivery_fee: Optional[float] | None = None
    subtotal: Optional[float] | None = None
    tax_amount: Optional[float] | None = None
    total_amount: Optional[float] | None = None
