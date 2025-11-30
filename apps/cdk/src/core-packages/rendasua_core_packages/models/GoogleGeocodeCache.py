from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class GoogleGeocodeCache(BaseModel):
    created_at: datetime.datetime
    expires_at: datetime.datetime
    id: str
    latitude: float
    longitude: float
    response_data: str
