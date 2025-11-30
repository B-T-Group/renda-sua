from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Address, Client

class ClientAddress(BaseModel):
    address: Optional[Address] | None = None
    address_id: str
    client: Optional[Client] | None = None
    client_id: str
    created_at: Optional[datetime.datetime] | None = None
    id: str
    updated_at: Optional[datetime.datetime] | None = None
