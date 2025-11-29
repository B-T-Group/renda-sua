from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import ItemsAvgField, ItemsMaxField, ItemsMinField, ItemsStddevField, ItemsStddevPopField, ItemsStddevSampField, ItemsSumField, ItemsVarPopField, ItemsVarSampField, ItemsVarianceField

class ItemsAggregateField(BaseModel):
    avg: Optional[ItemsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[ItemsMaxField] | None = None
    min: Optional[ItemsMinField] | None = None
    stddev: Optional[ItemsStddevField] | None = None
    stddev_pop: Optional[ItemsStddevPopField] | None = None
    stddev_samp: Optional[ItemsStddevSampField] | None = None
    sum: Optional[ItemsSumField] | None = None
    var_pop: Optional[ItemsVarPopField] | None = None
    var_samp: Optional[ItemsVarSampField] | None = None
    variance: Optional[ItemsVarianceField] | None = None
