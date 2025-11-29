from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AgentsMaxField, AgentsMinField

class AgentsAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[AgentsMaxField] | None = None
    min: Optional[AgentsMinField] | None = None
