from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class PaymentCallbacksMaxField(BaseModel):
    error_message: Optional[str] | None = None
    id: Optional[str] | None = None
    processed_at: Optional[datetime.datetime] | None = None
    received_at: Optional[datetime.datetime] | None = None
    transaction_id: Optional[str] | None = None
