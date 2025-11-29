from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ItemImagesStddevPopField(BaseModel):
    display_order: Optional[float] | None = None
    file_size: Optional[float] | None = None
    height: Optional[float] | None = None
    width: Optional[float] | None = None
