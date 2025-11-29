from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import OrderStatusHistoryAvgField, OrderStatusHistoryMaxField, OrderStatusHistoryMinField, OrderStatusHistoryStddevField, OrderStatusHistoryStddevPopField, OrderStatusHistoryStddevSampField, OrderStatusHistorySumField, OrderStatusHistoryVarPopField, OrderStatusHistoryVarSampField, OrderStatusHistoryVarianceField

class OrderStatusHistoryAggregateField(BaseModel):
    avg: Optional[OrderStatusHistoryAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[OrderStatusHistoryMaxField] | None = None
    min: Optional[OrderStatusHistoryMinField] | None = None
    stddev: Optional[OrderStatusHistoryStddevField] | None = None
    stddev_pop: Optional[OrderStatusHistoryStddevPopField] | None = None
    stddev_samp: Optional[OrderStatusHistoryStddevSampField] | None = None
    sum: Optional[OrderStatusHistorySumField] | None = None
    var_pop: Optional[OrderStatusHistoryVarPopField] | None = None
    var_samp: Optional[OrderStatusHistoryVarSampField] | None = None
    variance: Optional[OrderStatusHistoryVarianceField] | None = None
