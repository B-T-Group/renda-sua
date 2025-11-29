from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Agent, Businesse, Client, UserType

class UserTypesEnum(Enum):
    ADMIN = "admin"
    AGENT = "agent"
    BUSINESS = "business"
    CLIENT = "client"
    PARTNER = "partner"


class User(BaseModel):
    agent: Optional[Agent] | None = None
    business: Optional[Businesse] | None = None
    client: Optional[Client] | None = None
    created_at: Optional[datetime.datetime] | None = None
    email: Optional[str] | None = None
    email_verified: Optional[bool] | None = None
    first_name: Optional[str] | None = None
    id: Optional[str] | None = None
    identifier: Optional[str] | None = None
    last_name: Optional[str] | None = None
    phone_number: Optional[str] | None = None
    phone_number_verified: Optional[bool] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user_type: Optional[UserType] | None = None
    user_type_id: Optional[UserTypesEnum] | None = None
