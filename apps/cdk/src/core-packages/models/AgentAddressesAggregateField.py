from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AgentAddressesMaxField, AgentAddressesMinField

class AgentAddressesAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[AgentAddressesMaxField] | None = None
    min: Optional[AgentAddressesMinField] | None = None
