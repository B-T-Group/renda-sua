from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import OrderItemsAvgField, OrderItemsMaxField, OrderItemsMinField, OrderItemsStddevField, OrderItemsStddevPopField, OrderItemsStddevSampField, OrderItemsSumField, OrderItemsVarPopField, OrderItemsVarSampField, OrderItemsVarianceField

class OrderItemsAggregateField(BaseModel):
    avg: Optional[OrderItemsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[OrderItemsMaxField] | None = None
    min: Optional[OrderItemsMinField] | None = None
    stddev: Optional[OrderItemsStddevField] | None = None
    stddev_pop: Optional[OrderItemsStddevPopField] | None = None
    stddev_samp: Optional[OrderItemsStddevSampField] | None = None
    sum: Optional[OrderItemsSumField] | None = None
    var_pop: Optional[OrderItemsVarPopField] | None = None
    var_samp: Optional[OrderItemsVarSampField] | None = None
    variance: Optional[OrderItemsVarianceField] | None = None
