from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import BusinessInventoryAvgField, BusinessInventoryMaxField, BusinessInventoryMinField, BusinessInventoryStddevField, BusinessInventoryStddevPopField, BusinessInventoryStddevSampField, BusinessInventorySumField, BusinessInventoryVarPopField, BusinessInventoryVarSampField, BusinessInventoryVarianceField

class BusinessInventoryAggregateField(BaseModel):
    avg: Optional[BusinessInventoryAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[BusinessInventoryMaxField] | None = None
    min: Optional[BusinessInventoryMinField] | None = None
    stddev: Optional[BusinessInventoryStddevField] | None = None
    stddev_pop: Optional[BusinessInventoryStddevPopField] | None = None
    stddev_samp: Optional[BusinessInventoryStddevSampField] | None = None
    sum: Optional[BusinessInventorySumField] | None = None
    var_pop: Optional[BusinessInventoryVarPopField] | None = None
    var_samp: Optional[BusinessInventoryVarSampField] | None = None
    variance: Optional[BusinessInventoryVarianceField] | None = None
