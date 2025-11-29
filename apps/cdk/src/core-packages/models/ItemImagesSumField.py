from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemImagesSumField(BaseModel):
    display_order: Optional[int] | None = None
    file_size: Optional[int] | None = None
    height: Optional[int] | None = None
    width: Optional[int] | None = None
