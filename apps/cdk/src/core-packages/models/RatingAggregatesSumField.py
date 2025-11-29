from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class RatingAggregatesSumField(BaseModel):
    average_rating: Optional[float] | None = None
    rating_1_count: Optional[int] | None = None
    rating_2_count: Optional[int] | None = None
    rating_3_count: Optional[int] | None = None
    rating_4_count: Optional[int] | None = None
    rating_5_count: Optional[int] | None = None
    total_ratings: Optional[int] | None = None
