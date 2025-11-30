from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class Client(BaseModel):
    created_at: datetime.datetime
    id: str
    updated_at: datetime.datetime
    user: Optional[User] | None = None
    user_id: str
