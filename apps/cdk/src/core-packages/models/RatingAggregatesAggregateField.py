from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import RatingAggregatesAvgField, RatingAggregatesMaxField, RatingAggregatesMinField, RatingAggregatesStddevField, RatingAggregatesStddevPopField, RatingAggregatesStddevSampField, RatingAggregatesSumField, RatingAggregatesVarPopField, RatingAggregatesVarSampField, RatingAggregatesVarianceField

class RatingAggregatesAggregateField(BaseModel):
    avg: Optional[RatingAggregatesAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[RatingAggregatesMaxField] | None = None
    min: Optional[RatingAggregatesMinField] | None = None
    stddev: Optional[RatingAggregatesStddevField] | None = None
    stddev_pop: Optional[RatingAggregatesStddevPopField] | None = None
    stddev_samp: Optional[RatingAggregatesStddevSampField] | None = None
    sum: Optional[RatingAggregatesSumField] | None = None
    var_pop: Optional[RatingAggregatesVarPopField] | None = None
    var_samp: Optional[RatingAggregatesVarSampField] | None = None
    variance: Optional[RatingAggregatesVarianceField] | None = None
