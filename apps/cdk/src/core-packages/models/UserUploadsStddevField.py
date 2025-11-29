from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class UserUploadsStddevField(BaseModel):
    document_type_id: Optional[float] | None = None
    file_size: Optional[float] | None = None
