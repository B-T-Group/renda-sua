from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Item, User

class ItemImage(BaseModel):
    alt_text: Optional[str] | None = None
    caption: Optional[str] | None = None
    created_at: datetime.datetime
    display_order: Optional[int] | None = None
    file_size: Optional[int] | None = None
    format: Optional[str] | None = None
    height: Optional[int] | None = None
    id: str
    image_type: Optional[str] | None = None
    image_url: str
    is_active: Optional[bool] | None = None
    item: Optional[Item] | None = None
    item_id: str
    updated_at: datetime.datetime
    uploaded_by: Optional[str] | None = None
    uploaded_by_user: Optional[User] | None = None
    width: Optional[int] | None = None
