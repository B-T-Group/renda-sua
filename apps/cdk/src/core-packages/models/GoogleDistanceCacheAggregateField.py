from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import GoogleDistanceCacheAvgField, GoogleDistanceCacheMaxField, GoogleDistanceCacheMinField, GoogleDistanceCacheStddevField, GoogleDistanceCacheStddevPopField, GoogleDistanceCacheStddevSampField, GoogleDistanceCacheSumField, GoogleDistanceCacheVarPopField, GoogleDistanceCacheVarSampField, GoogleDistanceCacheVarianceField

class GoogleDistanceCacheAggregateField(BaseModel):
    avg: Optional[GoogleDistanceCacheAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[GoogleDistanceCacheMaxField] | None = None
    min: Optional[GoogleDistanceCacheMinField] | None = None
    stddev: Optional[GoogleDistanceCacheStddevField] | None = None
    stddev_pop: Optional[GoogleDistanceCacheStddevPopField] | None = None
    stddev_samp: Optional[GoogleDistanceCacheStddevSampField] | None = None
    sum: Optional[GoogleDistanceCacheSumField] | None = None
    var_pop: Optional[GoogleDistanceCacheVarPopField] | None = None
    var_samp: Optional[GoogleDistanceCacheVarSampField] | None = None
    variance: Optional[GoogleDistanceCacheVarianceField] | None = None
