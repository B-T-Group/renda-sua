from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class RatingsSumField(BaseModel):
    rating: Optional[int] | None = None
