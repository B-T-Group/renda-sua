from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import MobilePaymentTransactionsAvgField, MobilePaymentTransactionsMaxField, MobilePaymentTransactionsMinField, MobilePaymentTransactionsStddevField, MobilePaymentTransactionsStddevPopField, MobilePaymentTransactionsStddevSampField, MobilePaymentTransactionsSumField, MobilePaymentTransactionsVarPopField, MobilePaymentTransactionsVarSampField, MobilePaymentTransactionsVarianceField

class MobilePaymentTransactionsAggregateField(BaseModel):
    avg: Optional[MobilePaymentTransactionsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[MobilePaymentTransactionsMaxField] | None = None
    min: Optional[MobilePaymentTransactionsMinField] | None = None
    stddev: Optional[MobilePaymentTransactionsStddevField] | None = None
    stddev_pop: Optional[MobilePaymentTransactionsStddevPopField] | None = None
    stddev_samp: Optional[MobilePaymentTransactionsStddevSampField] | None = None
    sum: Optional[MobilePaymentTransactionsSumField] | None = None
    var_pop: Optional[MobilePaymentTransactionsVarPopField] | None = None
    var_samp: Optional[MobilePaymentTransactionsVarSampField] | None = None
    variance: Optional[MobilePaymentTransactionsVarianceField] | None = None
