from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class DeliveryConfig(BaseModel):
    config_key: str
    created_at: Optional[datetime.datetime] | None = None
    description: Optional[str] | None = None
    id: str
    updated_at: Optional[datetime.datetime] | None = None
