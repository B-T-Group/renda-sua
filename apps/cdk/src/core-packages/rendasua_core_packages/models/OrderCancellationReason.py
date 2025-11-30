from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrderCancellationReason(BaseModel):
    created_at: datetime.datetime
    display: str
    id: int
    rank: int
    updated_at: datetime.datetime
    value: str
