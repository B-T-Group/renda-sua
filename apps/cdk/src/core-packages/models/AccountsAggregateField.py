from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AccountsAvgField, AccountsMaxField, AccountsMinField, AccountsStddevField, AccountsStddevPopField, AccountsStddevSampField, AccountsSumField, AccountsVarPopField, AccountsVarSampField, AccountsVarianceField

class AccountsAggregateField(BaseModel):
    avg: Optional[AccountsAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[AccountsMaxField] | None = None
    min: Optional[AccountsMinField] | None = None
    stddev: Optional[AccountsStddevField] | None = None
    stddev_pop: Optional[AccountsStddevPopField] | None = None
    stddev_samp: Optional[AccountsStddevSampField] | None = None
    sum: Optional[AccountsSumField] | None = None
    var_pop: Optional[AccountsVarPopField] | None = None
    var_samp: Optional[AccountsVarSampField] | None = None
    variance: Optional[AccountsVarianceField] | None = None
