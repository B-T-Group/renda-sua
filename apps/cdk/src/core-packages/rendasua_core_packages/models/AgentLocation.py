from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Agent

class AgentLocation(BaseModel):
    agent: Optional[Agent] | None = None
    agent_id: str
    created_at: datetime.datetime
    id: str
    latitude: float
    longitude: float
    updated_at: datetime.datetime
