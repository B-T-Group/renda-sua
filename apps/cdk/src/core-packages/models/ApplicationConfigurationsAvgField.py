from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ApplicationConfigurationsAvgField(BaseModel):
    max_value: Optional[float] | None = None
    min_value: Optional[float] | None = None
    number_value: Optional[float] | None = None
    version: Optional[float] | None = None
