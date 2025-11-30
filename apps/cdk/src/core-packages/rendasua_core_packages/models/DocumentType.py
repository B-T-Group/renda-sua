from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class DocumentType(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    description: Optional[str] | None = None
    id: int
    name: str
    updated_at: Optional[datetime.datetime] | None = None
