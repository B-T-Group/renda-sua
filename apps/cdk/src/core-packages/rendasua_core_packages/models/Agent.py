from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import User, VehicleType

class VehicleTypeEnum(Enum):
    BUS = "bus"
    OTHER = "other"
    TRUCK = "truck"
    TT = "tt"
    VAN = "van"
    WHEELER_2 = "wheeler_2"
    WHEELER_3 = "wheeler_3"
    WHEELER_4 = "wheeler_4"


class Agent(BaseModel):
    created_at: datetime.datetime
    id: str
    is_verified: Optional[bool] | None = None
    updated_at: datetime.datetime
    user: Optional[User] | None = None
    user_id: str
    vehicle_type: Optional[VehicleType] | None = None
    vehicle_type_id: Optional[VehicleTypeEnum] | None = None
