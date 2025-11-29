from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class RatingAggregatesMinField(BaseModel):
    average_rating: Optional[float] | None = None
    entity_id: Optional[str] | None = None
    entity_type: Optional[str] | None = None
    id: Optional[str] | None = None
    last_rating_at: Optional[datetime.datetime] | None = None
    rating_1_count: Optional[int] | None = None
    rating_2_count: Optional[int] | None = None
    rating_3_count: Optional[int] | None = None
    rating_4_count: Optional[int] | None = None
    rating_5_count: Optional[int] | None = None
    total_ratings: Optional[int] | None = None
    updated_at: Optional[datetime.datetime] | None = None
