from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Order

class OrderAgentNotification(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    error_message: Optional[str] | None = None
    id: str
    notification_type: str
    order: Optional[Order] | None = None
    order_id: str
    processed_at: Optional[datetime.datetime] | None = None
    status: str
    updated_at: Optional[datetime.datetime] | None = None
