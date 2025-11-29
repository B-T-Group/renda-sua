from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Addresse, Businesse

class BusinessAddresse(BaseModel):
    address: Optional[Addresse] | None = None
    address_id: Optional[str] | None = None
    business: Optional[Businesse] | None = None
    business_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
