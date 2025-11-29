from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class AgentAddressesMaxField(BaseModel):
    address_id: Optional[str] | None = None
    agent_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
