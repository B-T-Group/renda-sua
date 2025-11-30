from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import DeliveryConfig

class CountryDeliveryConfig(BaseModel):
    config_key: str
    config_value: str
    country_code: str
    created_at: Optional[datetime.datetime] | None = None
    data_type: str
    delivery_config: Optional[DeliveryConfig] | None = None
    id: str
    updated_at: Optional[datetime.datetime] | None = None
