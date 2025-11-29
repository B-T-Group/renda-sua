from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import RatingsAvgField, RatingsMaxField, RatingsMinField, RatingsStddevField, RatingsStddevPopField, RatingsStddevSampField, RatingsSumField, RatingsVarPopField, RatingsVarSampField, RatingsVarianceField

class RatingsAggregateField(BaseModel):
    avg: Optional[RatingsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[RatingsMaxField] | None = None
    min: Optional[RatingsMinField] | None = None
    stddev: Optional[RatingsStddevField] | None = None
    stddev_pop: Optional[RatingsStddevPopField] | None = None
    stddev_samp: Optional[RatingsStddevSampField] | None = None
    sum: Optional[RatingsSumField] | None = None
    var_pop: Optional[RatingsVarPopField] | None = None
    var_samp: Optional[RatingsVarSampField] | None = None
    variance: Optional[RatingsVarianceField] | None = None
