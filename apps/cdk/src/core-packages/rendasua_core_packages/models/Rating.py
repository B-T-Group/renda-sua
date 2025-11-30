from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Order, User

class Rating(BaseModel):
    comment: Optional[str] | None = None
    created_at: datetime.datetime
    id: str
    is_public: Optional[bool] | None = None
    is_verified: Optional[bool] | None = None
    order_details: Optional[Order] | None = None
    order_id: str
    rated_entity_id: str
    rated_entity_type: str
    rater_user_details: Optional[User] | None = None
    rater_user_id: str
    rating: int
    rating_type: str
    updated_at: datetime.datetime
