from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import EntityType, User

class EntityTypesEnum(Enum):
    ACCOUNT = "account"
    ADDRESS = "address"
    AGENT = "agent"
    BUSINESS = "business"
    CLIENT = "client"
    DOCUMENT = "document"
    ITEM = "item"
    ORDER = "order"


class UserMessage(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    entity_id: Optional[str] | None = None
    entity_type: Optional[EntityTypesEnum] | None = None
    entity_type_info: Optional[EntityType] | None = None
    id: Optional[str] | None = None
    message: Optional[str] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: Optional[str] | None = None
