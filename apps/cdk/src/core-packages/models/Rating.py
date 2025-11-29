from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Order, User

class Rating(BaseModel):
    comment: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    is_public: Optional[bool] | None = None
    is_verified: Optional[bool] | None = None
    order_details: Optional[Order] | None = None
    order_id: Optional[str] | None = None
    rated_entity_id: Optional[str] | None = None
    rated_entity_type: Optional[str] | None = None
    rater_user_details: Optional[User] | None = None
    rater_user_id: Optional[str] | None = None
    rating: Optional[int] | None = None
    rating_type: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
