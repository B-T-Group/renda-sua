from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AccountTransaction, Order, User

class CommissionPayout(BaseModel):
    account_transaction: Optional[AccountTransaction] | None = None
    account_transaction_id: Optional[str] | None = None
    amount: float
    commission_percentage: Optional[float] | None = None
    commission_type: str
    created_at: datetime.datetime
    currency: str
    id: str
    order: Optional[Order] | None = None
    order_id: str
    recipient_type: str
    recipient_user: Optional[User] | None = None
    recipient_user_id: str
