from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class GoogleDistanceCacheSumField(BaseModel):
    distance_value: Optional[int] | None = None
    duration_value: Optional[int] | None = None
