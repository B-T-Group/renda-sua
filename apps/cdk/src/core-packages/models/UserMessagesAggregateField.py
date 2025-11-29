from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import UserMessagesMaxField, UserMessagesMinField

class UserMessagesAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[UserMessagesMaxField] | None = None
    min: Optional[UserMessagesMinField] | None = None
