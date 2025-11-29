from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import GoogleGeocodeCacheAvgField, GoogleGeocodeCacheMaxField, GoogleGeocodeCacheMinField, GoogleGeocodeCacheStddevField, GoogleGeocodeCacheStddevPopField, GoogleGeocodeCacheStddevSampField, GoogleGeocodeCacheSumField, GoogleGeocodeCacheVarPopField, GoogleGeocodeCacheVarSampField, GoogleGeocodeCacheVarianceField

class GoogleGeocodeCacheAggregateField(BaseModel):
    avg: Optional[GoogleGeocodeCacheAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[GoogleGeocodeCacheMaxField] | None = None
    min: Optional[GoogleGeocodeCacheMinField] | None = None
    stddev: Optional[GoogleGeocodeCacheStddevField] | None = None
    stddev_pop: Optional[GoogleGeocodeCacheStddevPopField] | None = None
    stddev_samp: Optional[GoogleGeocodeCacheStddevSampField] | None = None
    sum: Optional[GoogleGeocodeCacheSumField] | None = None
    var_pop: Optional[GoogleGeocodeCacheVarPopField] | None = None
    var_samp: Optional[GoogleGeocodeCacheVarSampField] | None = None
    variance: Optional[GoogleGeocodeCacheVarianceField] | None = None
