from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class UserUploadsMinField(BaseModel):
    content_type: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    document_type_id: Optional[int] | None = None
    file_name: Optional[str] | None = None
    file_size: Optional[int] | None = None
    id: Optional[str] | None = None
    key: Optional[str] | None = None
    note: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user_id: Optional[str] | None = None
