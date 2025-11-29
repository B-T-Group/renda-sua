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
    created_at: Optional[datetime.datetime] | None = None
    display_order: Optional[int] | None = None
    file_size: Optional[int] | None = None
    format: Optional[str] | None = None
    height: Optional[int] | None = None
    id: Optional[str] | None = None
    image_type: Optional[str] | None = None
    image_url: Optional[str] | None = None
    is_active: Optional[bool] | None = None
    item: Optional[Item] | None = None
    item_id: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    uploaded_by: Optional[str] | None = None
    uploaded_by_user: Optional[User] | None = None
    width: Optional[int] | None = None
