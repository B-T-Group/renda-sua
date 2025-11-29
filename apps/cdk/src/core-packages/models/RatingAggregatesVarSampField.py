from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class RatingAggregatesVarSampField(BaseModel):
    average_rating: Optional[float] | None = None
    rating_1_count: Optional[float] | None = None
    rating_2_count: Optional[float] | None = None
    rating_3_count: Optional[float] | None = None
    rating_4_count: Optional[float] | None = None
    rating_5_count: Optional[float] | None = None
    total_ratings: Optional[float] | None = None
