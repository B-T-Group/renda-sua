from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Agent, Business, Client, UserType

class UserTypeEnum(Enum):
    ADMIN = "admin"
    AGENT = "agent"
    BUSINESS = "business"
    CLIENT = "client"
    PARTNER = "partner"


class User(BaseModel):
    agent: Optional[Agent] | None = None
    business: Optional[Business] | None = None
    client: Optional[Client] | None = None
    created_at: datetime.datetime
    email: str
    email_verified: Optional[bool] | None = None
    first_name: str
    id: str
    identifier: str
    last_name: str
    phone_number: Optional[str] | None = None
    phone_number_verified: Optional[bool] | None = None
    updated_at: datetime.datetime
    user_type: Optional[UserType] | None = None
    user_type_id: Optional[UserTypeEnum] | None = None
