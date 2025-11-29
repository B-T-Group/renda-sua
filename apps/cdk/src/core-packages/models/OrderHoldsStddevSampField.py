from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrderHoldsStddevSampField(BaseModel):
    agent_hold_amount: Optional[float] | None = None
    client_hold_amount: Optional[float] | None = None
    delivery_fees: Optional[float] | None = None
