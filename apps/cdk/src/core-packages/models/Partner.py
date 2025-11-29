from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class Partner(BaseModel):
    base_delivery_fee_commission: Optional[float] | None = None
    company_name: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    is_active: Optional[bool] | None = None
    item_commission: Optional[float] | None = None
    per_km_delivery_fee_commission: Optional[float] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: Optional[str] | None = None
