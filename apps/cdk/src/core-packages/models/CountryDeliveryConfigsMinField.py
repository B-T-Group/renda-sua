from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class CountryDeliveryConfigsMinField(BaseModel):
    config_key: Optional[str] | None = None
    config_value: Optional[str] | None = None
    country_code: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    data_type: Optional[str] | None = None
    id: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
