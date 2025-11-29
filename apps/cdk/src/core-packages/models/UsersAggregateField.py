from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import UsersMaxField, UsersMinField

class UsersAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[UsersMaxField] | None = None
    min: Optional[UsersMinField] | None = None
