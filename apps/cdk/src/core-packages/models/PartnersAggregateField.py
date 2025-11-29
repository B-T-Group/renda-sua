from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import PartnersAvgField, PartnersMaxField, PartnersMinField, PartnersStddevField, PartnersStddevPopField, PartnersStddevSampField, PartnersSumField, PartnersVarPopField, PartnersVarSampField, PartnersVarianceField

class PartnersAggregateField(BaseModel):
    avg: Optional[PartnersAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[PartnersMaxField] | None = None
    min: Optional[PartnersMinField] | None = None
    stddev: Optional[PartnersStddevField] | None = None
    stddev_pop: Optional[PartnersStddevPopField] | None = None
    stddev_samp: Optional[PartnersStddevSampField] | None = None
    sum: Optional[PartnersSumField] | None = None
    var_pop: Optional[PartnersVarPopField] | None = None
    var_samp: Optional[PartnersVarSampField] | None = None
    variance: Optional[PartnersVarianceField] | None = None
