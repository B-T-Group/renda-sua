from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class PartnersMinField(BaseModel):
    base_delivery_fee_commission: Optional[float] | None = None
    company_name: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    item_commission: Optional[float] | None = None
    per_km_delivery_fee_commission: Optional[float] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user_id: Optional[str] | None = None
