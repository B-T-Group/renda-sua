from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class SupportedCountryStatesMaxField(BaseModel):
    country_code: Optional[str] | None = None
    country_name: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    created_by: Optional[str] | None = None
    currency_code: Optional[str] | None = None
    id: Optional[str] | None = None
    launch_date: Optional[datetime.date] | None = None
    service_status: Optional[str] | None = None
    state_name: Optional[str] | None = None
    supported_payment_methods: Optional[List[str]] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    updated_by: Optional[str] | None = None
