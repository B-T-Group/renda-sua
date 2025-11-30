from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class SupportedPaymentSystem(BaseModel):
    active: bool
    country: str
    created_at: datetime.datetime
    id: str
    name: str
    updated_at: datetime.datetime
