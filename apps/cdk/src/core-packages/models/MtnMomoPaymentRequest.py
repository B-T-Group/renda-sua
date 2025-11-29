from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class MtnMomoPaymentRequest(BaseModel):
    amount: Optional[float] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    external_id: Optional[str] | None = None
    id: Optional[str] | None = None
    payee_note: Optional[str] | None = None
    payer_message: Optional[str] | None = None
    status: Optional[str] | None = None
    transaction_id: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: Optional[str] | None = None
