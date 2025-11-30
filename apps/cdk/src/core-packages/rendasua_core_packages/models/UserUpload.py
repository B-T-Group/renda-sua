from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import DocumentType, User

class UserUpload(BaseModel):
    content_type: str
    created_at: Optional[datetime.datetime] | None = None
    document_type: Optional[DocumentType] | None = None
    document_type_id: int
    file_name: str
    file_size: Optional[int] | None = None
    id: str
    is_approved: bool
    key: str
    note: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: str
