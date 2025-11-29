from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class OrderStatusHistoryStddevPopField(BaseModel):
    location_lat: Optional[float] | None = None
    location_lng: Optional[float] | None = None
