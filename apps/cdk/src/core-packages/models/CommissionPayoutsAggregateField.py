from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import CommissionPayoutsAvgField, CommissionPayoutsMaxField, CommissionPayoutsMinField, CommissionPayoutsStddevField, CommissionPayoutsStddevPopField, CommissionPayoutsStddevSampField, CommissionPayoutsSumField, CommissionPayoutsVarPopField, CommissionPayoutsVarSampField, CommissionPayoutsVarianceField

class CommissionPayoutsAggregateField(BaseModel):
    avg: Optional[CommissionPayoutsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[CommissionPayoutsMaxField] | None = None
    min: Optional[CommissionPayoutsMinField] | None = None
    stddev: Optional[CommissionPayoutsStddevField] | None = None
    stddev_pop: Optional[CommissionPayoutsStddevPopField] | None = None
    stddev_samp: Optional[CommissionPayoutsStddevSampField] | None = None
    sum: Optional[CommissionPayoutsSumField] | None = None
    var_pop: Optional[CommissionPayoutsVarPopField] | None = None
    var_samp: Optional[CommissionPayoutsVarSampField] | None = None
    variance: Optional[CommissionPayoutsVarianceField] | None = None
