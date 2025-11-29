from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import SupportedCountryStatesMaxField, SupportedCountryStatesMinField

class SupportedCountryStatesAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[SupportedCountryStatesMaxField] | None = None
    min: Optional[SupportedCountryStatesMinField] | None = None
