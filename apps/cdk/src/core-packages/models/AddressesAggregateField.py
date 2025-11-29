from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import AddressesAvgField, AddressesMaxField, AddressesMinField, AddressesStddevField, AddressesStddevPopField, AddressesStddevSampField, AddressesSumField, AddressesVarPopField, AddressesVarSampField, AddressesVarianceField

class AddressesAggregateField(BaseModel):
    avg: Optional[AddressesAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[AddressesMaxField] | None = None
    min: Optional[AddressesMinField] | None = None
    stddev: Optional[AddressesStddevField] | None = None
    stddev_pop: Optional[AddressesStddevPopField] | None = None
    stddev_samp: Optional[AddressesStddevSampField] | None = None
    sum: Optional[AddressesSumField] | None = None
    var_pop: Optional[AddressesVarPopField] | None = None
    var_samp: Optional[AddressesVarSampField] | None = None
    variance: Optional[AddressesVarianceField] | None = None
