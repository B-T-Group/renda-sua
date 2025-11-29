from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AgentLocationsAvgField, AgentLocationsMaxField, AgentLocationsMinField, AgentLocationsStddevField, AgentLocationsStddevPopField, AgentLocationsStddevSampField, AgentLocationsSumField, AgentLocationsVarPopField, AgentLocationsVarSampField, AgentLocationsVarianceField

class AgentLocationsAggregateField(BaseModel):
    avg: Optional[AgentLocationsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[AgentLocationsMaxField] | None = None
    min: Optional[AgentLocationsMinField] | None = None
    stddev: Optional[AgentLocationsStddevField] | None = None
    stddev_pop: Optional[AgentLocationsStddevPopField] | None = None
    stddev_samp: Optional[AgentLocationsStddevSampField] | None = None
    sum: Optional[AgentLocationsSumField] | None = None
    var_pop: Optional[AgentLocationsVarPopField] | None = None
    var_samp: Optional[AgentLocationsVarSampField] | None = None
    variance: Optional[AgentLocationsVarianceField] | None = None
