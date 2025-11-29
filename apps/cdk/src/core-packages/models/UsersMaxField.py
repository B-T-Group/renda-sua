from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class UsersMaxField(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    email: Optional[str] | None = None
    first_name: Optional[str] | None = None
    id: Optional[str] | None = None
    identifier: Optional[str] | None = None
    last_name: Optional[str] | None = None
    phone_number: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
