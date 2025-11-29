from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class GoogleDistanceCacheAvgField(BaseModel):
    distance_value: Optional[float] | None = None
    duration_value: Optional[float] | None = None
