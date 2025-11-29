from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrderCancellationReason(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    display: Optional[str] | None = None
    id: Optional[int] | None = None
    rank: Optional[int] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    value: Optional[str] | None = None
