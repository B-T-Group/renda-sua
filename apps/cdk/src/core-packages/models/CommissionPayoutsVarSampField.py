from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class CommissionPayoutsVarSampField(BaseModel):
    amount: Optional[float] | None = None
    commission_percentage: Optional[float] | None = None
