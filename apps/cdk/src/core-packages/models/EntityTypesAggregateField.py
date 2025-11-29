from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import EntityTypesMaxField, EntityTypesMinField

class EntityTypesAggregateField(BaseModel):
    count: Optional[int] | None = None
    max: Optional[EntityTypesMaxField] | None = None
    min: Optional[EntityTypesMinField] | None = None
