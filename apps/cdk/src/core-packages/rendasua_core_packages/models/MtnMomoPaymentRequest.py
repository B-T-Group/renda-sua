from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class MtnMomoPaymentRequest(BaseModel):
    amount: float
    created_at: Optional[datetime.datetime] | None = None
    currency: str
    external_id: str
    id: str
    payee_note: Optional[str] | None = None
    payer_message: Optional[str] | None = None
    status: str
    transaction_id: str
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: str
