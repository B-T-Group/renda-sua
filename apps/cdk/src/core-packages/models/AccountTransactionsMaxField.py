from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class AccountTransactionsMaxField(BaseModel):
    account_id: Optional[str] | None = None
    amount: Optional[float] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    memo: Optional[str] | None = None
    reference_id: Optional[str] | None = None
    transaction_type: Optional[str] | None = None
