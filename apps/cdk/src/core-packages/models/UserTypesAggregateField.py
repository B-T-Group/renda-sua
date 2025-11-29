from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import UserTypesMaxField, UserTypesMinField

class UserTypesAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[UserTypesMaxField] | None = None
    min: Optional[UserTypesMinField] | None = None
