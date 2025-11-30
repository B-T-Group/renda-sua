from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class Partner(BaseModel):
    base_delivery_fee_commission: float
    company_name: str
    created_at: datetime.datetime
    id: str
    is_active: Optional[bool] | None = None
    item_commission: float
    per_km_delivery_fee_commission: float
    updated_at: datetime.datetime
    user: Optional[User] | None = None
    user_id: str
