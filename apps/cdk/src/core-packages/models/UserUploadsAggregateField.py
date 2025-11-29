from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import UserUploadsAvgField, UserUploadsMaxField, UserUploadsMinField, UserUploadsStddevField, UserUploadsStddevPopField, UserUploadsStddevSampField, UserUploadsSumField, UserUploadsVarPopField, UserUploadsVarSampField, UserUploadsVarianceField

class UserUploadsAggregateField(BaseModel):
    avg: Optional[UserUploadsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[UserUploadsMaxField] | None = None
    min: Optional[UserUploadsMinField] | None = None
    stddev: Optional[UserUploadsStddevField] | None = None
    stddev_pop: Optional[UserUploadsStddevPopField] | None = None
    stddev_samp: Optional[UserUploadsStddevSampField] | None = None
    sum: Optional[UserUploadsSumField] | None = None
    var_pop: Optional[UserUploadsVarPopField] | None = None
    var_samp: Optional[UserUploadsVarSampField] | None = None
    variance: Optional[UserUploadsVarianceField] | None = None
