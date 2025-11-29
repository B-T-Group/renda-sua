from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import OrderHoldsAvgField, OrderHoldsMaxField, OrderHoldsMinField, OrderHoldsStddevField, OrderHoldsStddevPopField, OrderHoldsStddevSampField, OrderHoldsSumField, OrderHoldsVarPopField, OrderHoldsVarSampField, OrderHoldsVarianceField

class OrderHoldsAggregateField(BaseModel):
    avg: Optional[OrderHoldsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[OrderHoldsMaxField] | None = None
    min: Optional[OrderHoldsMinField] | None = None
    stddev: Optional[OrderHoldsStddevField] | None = None
    stddev_pop: Optional[OrderHoldsStddevPopField] | None = None
    stddev_samp: Optional[OrderHoldsStddevSampField] | None = None
    sum: Optional[OrderHoldsSumField] | None = None
    var_pop: Optional[OrderHoldsVarPopField] | None = None
    var_samp: Optional[OrderHoldsVarSampField] | None = None
    variance: Optional[OrderHoldsVarianceField] | None = None
