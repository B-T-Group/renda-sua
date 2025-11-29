from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import OrdersAvgField, OrdersMaxField, OrdersMinField, OrdersStddevField, OrdersStddevPopField, OrdersStddevSampField, OrdersSumField, OrdersVarPopField, OrdersVarSampField, OrdersVarianceField

class OrdersAggregateField(BaseModel):
    avg: Optional[OrdersAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[OrdersMaxField] | None = None
    min: Optional[OrdersMinField] | None = None
    stddev: Optional[OrdersStddevField] | None = None
    stddev_pop: Optional[OrdersStddevPopField] | None = None
    stddev_samp: Optional[OrdersStddevSampField] | None = None
    sum: Optional[OrdersSumField] | None = None
    var_pop: Optional[OrdersVarPopField] | None = None
    var_samp: Optional[OrdersVarSampField] | None = None
    variance: Optional[OrdersVarianceField] | None = None
