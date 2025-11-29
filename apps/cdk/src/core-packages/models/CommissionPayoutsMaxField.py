from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class CommissionPayoutsMaxField(BaseModel):
    account_transaction_id: Optional[str] | None = None
    amount: Optional[float] | None = None
    commission_percentage: Optional[float] | None = None
    commission_type: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    id: Optional[str] | None = None
    order_id: Optional[str] | None = None
    recipient_type: Optional[str] | None = None
    recipient_user_id: Optional[str] | None = None
