from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class PartnersVarPopField(BaseModel):
    base_delivery_fee_commission: Optional[float] | None = None
    item_commission: Optional[float] | None = None
    per_km_delivery_fee_commission: Optional[float] | None = None
