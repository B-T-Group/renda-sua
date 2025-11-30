from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import EntityType, User

class EntityTypeEnum(Enum):
    ACCOUNT = "account"
    ADDRESS = "address"
    AGENT = "agent"
    BUSINESS = "business"
    CLIENT = "client"
    DOCUMENT = "document"
    ITEM = "item"
    ORDER = "order"


class UserMessage(BaseModel):
    created_at: datetime.datetime
    entity_id: str
    entity_type: Optional[EntityTypeEnum] | None = None
    entity_type_info: Optional[EntityType] | None = None
    id: str
    message: str
    updated_at: datetime.datetime
    user: Optional[User] | None = None
    user_id: str
