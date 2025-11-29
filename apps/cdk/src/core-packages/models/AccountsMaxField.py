from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class AccountsMaxField(BaseModel):
    available_balance: Optional[float] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    id: Optional[str] | None = None
    total_balance: Optional[float] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user_id: Optional[str] | None = None
    withheld_balance: Optional[float] | None = None
