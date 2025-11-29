from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import OrderCancellationReasonsAvgField, OrderCancellationReasonsMaxField, OrderCancellationReasonsMinField, OrderCancellationReasonsStddevField, OrderCancellationReasonsStddevPopField, OrderCancellationReasonsStddevSampField, OrderCancellationReasonsSumField, OrderCancellationReasonsVarPopField, OrderCancellationReasonsVarSampField, OrderCancellationReasonsVarianceField

class OrderCancellationReasonsAggregateField(BaseModel):
    avg: Optional[OrderCancellationReasonsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[OrderCancellationReasonsMaxField] | None = None
    min: Optional[OrderCancellationReasonsMinField] | None = None
    stddev: Optional[OrderCancellationReasonsStddevField] | None = None
    stddev_pop: Optional[OrderCancellationReasonsStddevPopField] | None = None
    stddev_samp: Optional[OrderCancellationReasonsStddevSampField] | None = None
    sum: Optional[OrderCancellationReasonsSumField] | None = None
    var_pop: Optional[OrderCancellationReasonsVarPopField] | None = None
    var_samp: Optional[OrderCancellationReasonsVarSampField] | None = None
    variance: Optional[OrderCancellationReasonsVarianceField] | None = None
