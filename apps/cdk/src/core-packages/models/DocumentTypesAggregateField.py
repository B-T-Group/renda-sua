from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import DocumentTypesAvgField, DocumentTypesMaxField, DocumentTypesMinField, DocumentTypesStddevField, DocumentTypesStddevPopField, DocumentTypesStddevSampField, DocumentTypesSumField, DocumentTypesVarPopField, DocumentTypesVarSampField, DocumentTypesVarianceField

class DocumentTypesAggregateField(BaseModel):
    avg: Optional[DocumentTypesAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[DocumentTypesMaxField] | None = None
    min: Optional[DocumentTypesMinField] | None = None
    stddev: Optional[DocumentTypesStddevField] | None = None
    stddev_pop: Optional[DocumentTypesStddevPopField] | None = None
    stddev_samp: Optional[DocumentTypesStddevSampField] | None = None
    sum: Optional[DocumentTypesSumField] | None = None
    var_pop: Optional[DocumentTypesVarPopField] | None = None
    var_samp: Optional[DocumentTypesVarSampField] | None = None
    variance: Optional[DocumentTypesVarianceField] | None = None
