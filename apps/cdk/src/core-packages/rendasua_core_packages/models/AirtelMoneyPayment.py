from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class AirtelMoneyPayment(BaseModel):
    amount: str
    callback_data: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: str
    id: str
    message: Optional[str] | None = None
    notes: Optional[str] | None = None
    reference: str
    status: str
    transaction_id: str
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: str
