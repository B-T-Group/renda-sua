from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Agent, Client, Order

class OrderHold(BaseModel):
    agent: Optional[Agent] | None = None
    agent_hold_amount: float
    agent_id: Optional[str] | None = None
    client: Optional[Client] | None = None
    client_hold_amount: float
    client_id: str
    created_at: datetime.datetime
    currency: str
    delivery_fees: float
    id: str
    order: Optional[Order] | None = None
    order_id: str
    status: str
    updated_at: datetime.datetime
