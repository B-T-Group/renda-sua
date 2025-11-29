from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User

class Businesse(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    is_admin: Optional[bool] | None = None
    is_verified: Optional[bool] | None = None
    name: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: Optional[str] | None = None
