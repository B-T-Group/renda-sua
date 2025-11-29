from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class AirtelMoneyPayment(BaseModel):
    amount: Optional[str] | None = None
    callback_data: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    id: Optional[str] | None = None
    message: Optional[str] | None = None
    notes: Optional[str] | None = None
    reference: Optional[str] | None = None
    status: Optional[str] | None = None
    transaction_id: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: Optional[str] | None = None
