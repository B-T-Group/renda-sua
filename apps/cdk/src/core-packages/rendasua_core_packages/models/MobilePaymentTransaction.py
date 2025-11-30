from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Account

class MobilePaymentTransaction(BaseModel):
    account: Optional[Account] | None = None
    account_id: Optional[str] | None = None
    amount: float
    created_at: Optional[datetime.datetime] | None = None
    currency: str
    customer_email: Optional[str] | None = None
    customer_phone: Optional[str] | None = None
    description: str
    entity_id: Optional[str] | None = None
    error_code: Optional[str] | None = None
    error_message: Optional[str] | None = None
    id: str
    payment_entity: Optional[str] | None = None
    payment_method: str
    provider: str
    reference: str
    status: str
    transaction_id: Optional[str] | None = None
    transaction_type: str
    updated_at: Optional[datetime.datetime] | None = None
