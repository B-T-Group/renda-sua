from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class Account(BaseModel):
    available_balance: Optional[float] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    id: Optional[str] | None = None
    is_active: Optional[bool] | None = None
    total_balance: Optional[float] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: Optional[str] | None = None
    withheld_balance: Optional[float] | None = None
