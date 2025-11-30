from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import MobilePaymentTransaction

class PaymentCallback(BaseModel):
    callback_data: str
    error_message: Optional[str] | None = None
    id: str
    mobile_payment_transaction: Optional[MobilePaymentTransaction] | None = None
    processed: Optional[bool] | None = None
    processed_at: Optional[datetime.datetime] | None = None
    received_at: Optional[datetime.datetime] | None = None
    transaction_id: str
