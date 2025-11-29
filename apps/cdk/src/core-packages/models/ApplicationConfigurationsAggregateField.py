from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import ApplicationConfigurationsAvgField, ApplicationConfigurationsMaxField, ApplicationConfigurationsMinField, ApplicationConfigurationsStddevField, ApplicationConfigurationsStddevPopField, ApplicationConfigurationsStddevSampField, ApplicationConfigurationsSumField, ApplicationConfigurationsVarPopField, ApplicationConfigurationsVarSampField, ApplicationConfigurationsVarianceField

class ApplicationConfigurationsAggregateField(BaseModel):
    avg: Optional[ApplicationConfigurationsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[ApplicationConfigurationsMaxField] | None = None
    min: Optional[ApplicationConfigurationsMinField] | None = None
    stddev: Optional[ApplicationConfigurationsStddevField] | None = None
    stddev_pop: Optional[ApplicationConfigurationsStddevPopField] | None = None
    stddev_samp: Optional[ApplicationConfigurationsStddevSampField] | None = None
    sum: Optional[ApplicationConfigurationsSumField] | None = None
    var_pop: Optional[ApplicationConfigurationsVarPopField] | None = None
    var_samp: Optional[ApplicationConfigurationsVarSampField] | None = None
    variance: Optional[ApplicationConfigurationsVarianceField] | None = None
