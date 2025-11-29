from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class AccountsVarPopField(BaseModel):
    available_balance: Optional[float] | None = None
    total_balance: Optional[float] | None = None
    withheld_balance: Optional[float] | None = None
