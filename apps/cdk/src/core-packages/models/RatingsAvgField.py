from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class RatingsAvgField(BaseModel):
    rating: Optional[float] | None = None
