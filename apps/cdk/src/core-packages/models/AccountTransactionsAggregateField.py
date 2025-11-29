from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AccountTransactionsAvgField, AccountTransactionsMaxField, AccountTransactionsMinField, AccountTransactionsStddevField, AccountTransactionsStddevPopField, AccountTransactionsStddevSampField, AccountTransactionsSumField, AccountTransactionsVarPopField, AccountTransactionsVarSampField, AccountTransactionsVarianceField

class AccountTransactionsAggregateField(BaseModel):
    avg: Optional[AccountTransactionsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[AccountTransactionsMaxField] | None = None
    min: Optional[AccountTransactionsMinField] | None = None
    stddev: Optional[AccountTransactionsStddevField] | None = None
    stddev_pop: Optional[AccountTransactionsStddevPopField] | None = None
    stddev_samp: Optional[AccountTransactionsStddevSampField] | None = None
    sum: Optional[AccountTransactionsSumField] | None = None
    var_pop: Optional[AccountTransactionsVarPopField] | None = None
    var_samp: Optional[AccountTransactionsVarSampField] | None = None
    variance: Optional[AccountTransactionsVarianceField] | None = None
