from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class MobilePaymentTransactionsMaxField(BaseModel):
    account_id: Optional[str] | None = None
    amount: Optional[float] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    customer_email: Optional[str] | None = None
    customer_phone: Optional[str] | None = None
    description: Optional[str] | None = None
    entity_id: Optional[str] | None = None
    error_code: Optional[str] | None = None
    error_message: Optional[str] | None = None
    id: Optional[str] | None = None
    payment_entity: Optional[str] | None = None
    payment_method: Optional[str] | None = None
    provider: Optional[str] | None = None
    reference: Optional[str] | None = None
    status: Optional[str] | None = None
    transaction_id: Optional[str] | None = None
    transaction_type: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
