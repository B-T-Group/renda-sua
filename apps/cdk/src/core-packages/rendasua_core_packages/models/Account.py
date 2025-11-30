from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class Account(BaseModel):
    available_balance: float
    created_at: datetime.datetime
    currency: str
    id: str
    is_active: Optional[bool] | None = None
    total_balance: Optional[float] | None = None
    updated_at: datetime.datetime
    user: Optional[User] | None = None
    user_id: str
    withheld_balance: float
