from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import DeliveryTimeSlotsAvgField, DeliveryTimeSlotsMaxField, DeliveryTimeSlotsMinField, DeliveryTimeSlotsStddevField, DeliveryTimeSlotsStddevPopField, DeliveryTimeSlotsStddevSampField, DeliveryTimeSlotsSumField, DeliveryTimeSlotsVarPopField, DeliveryTimeSlotsVarSampField, DeliveryTimeSlotsVarianceField

class DeliveryTimeSlotsAggregateField(BaseModel):
    avg: Optional[DeliveryTimeSlotsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[DeliveryTimeSlotsMaxField] | None = None
    min: Optional[DeliveryTimeSlotsMinField] | None = None
    stddev: Optional[DeliveryTimeSlotsStddevField] | None = None
    stddev_pop: Optional[DeliveryTimeSlotsStddevPopField] | None = None
    stddev_samp: Optional[DeliveryTimeSlotsStddevSampField] | None = None
    sum: Optional[DeliveryTimeSlotsSumField] | None = None
    var_pop: Optional[DeliveryTimeSlotsVarPopField] | None = None
    var_samp: Optional[DeliveryTimeSlotsVarSampField] | None = None
    variance: Optional[DeliveryTimeSlotsVarianceField] | None = None
