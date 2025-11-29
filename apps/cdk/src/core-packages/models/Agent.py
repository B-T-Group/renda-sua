from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User, VehicleType

class VehicleTypesEnum(Enum):
    BUS = "bus"
    OTHER = "other"
    TRUCK = "truck"
    TT = "tt"
    VAN = "van"
    WHEELER_2 = "wheeler_2"
    WHEELER_3 = "wheeler_3"
    WHEELER_4 = "wheeler_4"


class Agent(BaseModel):
    created_at: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    is_verified: Optional[bool] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    user: Optional[User] | None = None
    user_id: Optional[str] | None = None
    vehicle_type: Optional[VehicleType] | None = None
    vehicle_type_id: Optional[VehicleTypesEnum] | None = None
