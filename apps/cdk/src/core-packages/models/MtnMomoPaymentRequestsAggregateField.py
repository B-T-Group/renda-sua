from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import MtnMomoPaymentRequestsAvgField, MtnMomoPaymentRequestsMaxField, MtnMomoPaymentRequestsMinField, MtnMomoPaymentRequestsStddevField, MtnMomoPaymentRequestsStddevPopField, MtnMomoPaymentRequestsStddevSampField, MtnMomoPaymentRequestsSumField, MtnMomoPaymentRequestsVarPopField, MtnMomoPaymentRequestsVarSampField, MtnMomoPaymentRequestsVarianceField

class MtnMomoPaymentRequestsAggregateField(BaseModel):
    avg: Optional[MtnMomoPaymentRequestsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[MtnMomoPaymentRequestsMaxField] | None = None
    min: Optional[MtnMomoPaymentRequestsMinField] | None = None
    stddev: Optional[MtnMomoPaymentRequestsStddevField] | None = None
    stddev_pop: Optional[MtnMomoPaymentRequestsStddevPopField] | None = None
    stddev_samp: Optional[MtnMomoPaymentRequestsStddevSampField] | None = None
    sum: Optional[MtnMomoPaymentRequestsSumField] | None = None
    var_pop: Optional[MtnMomoPaymentRequestsVarPopField] | None = None
    var_samp: Optional[MtnMomoPaymentRequestsVarSampField] | None = None
    variance: Optional[MtnMomoPaymentRequestsVarianceField] | None = None
