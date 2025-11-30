from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class RatingAggregate(BaseModel):
    average_rating: float
    entity_id: str
    entity_type: str
    id: str
    last_rating_at: Optional[datetime.datetime] | None = None
    rating_1_count: int
    rating_2_count: int
    rating_3_count: int
    rating_4_count: int
    rating_5_count: int
    total_ratings: int
    updated_at: datetime.datetime
