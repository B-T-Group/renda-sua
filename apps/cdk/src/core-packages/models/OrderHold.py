from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Agent, Client, Order

class OrderHold(BaseModel):
    agent: Optional[Agent] | None = None
    agent_hold_amount: Optional[float] | None = None
    agent_id: Optional[str] | None = None
    client: Optional[Client] | None = None
    client_hold_amount: Optional[float] | None = None
    client_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    delivery_fees: Optional[float] | None = None
    id: Optional[str] | None = None
    order: Optional[Order] | None = None
    order_id: Optional[str] | None = None
    status: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
