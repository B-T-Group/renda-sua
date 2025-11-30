from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class SupportedCountryState(BaseModel):
    country_code: str
    country_name: str
    created_at: Optional[datetime.datetime] | None = None
    created_by: Optional[str] | None = None
    currency_code: str
    delivery_enabled: bool
    id: str
    launch_date: Optional[datetime.date] | None = None
    service_status: str
    state_name: str
    supported_payment_methods: Optional[List[str]] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    updated_by: Optional[str] | None = None
