from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import ItemSubCategoriesAvgField, ItemSubCategoriesMaxField, ItemSubCategoriesMinField, ItemSubCategoriesStddevField, ItemSubCategoriesStddevPopField, ItemSubCategoriesStddevSampField, ItemSubCategoriesSumField, ItemSubCategoriesVarPopField, ItemSubCategoriesVarSampField, ItemSubCategoriesVarianceField

class ItemSubCategoriesAggregateField(BaseModel):
    avg: Optional[ItemSubCategoriesAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[ItemSubCategoriesMaxField] | None = None
    min: Optional[ItemSubCategoriesMinField] | None = None
    stddev: Optional[ItemSubCategoriesStddevField] | None = None
    stddev_pop: Optional[ItemSubCategoriesStddevPopField] | None = None
    stddev_samp: Optional[ItemSubCategoriesStddevSampField] | None = None
    sum: Optional[ItemSubCategoriesSumField] | None = None
    var_pop: Optional[ItemSubCategoriesVarPopField] | None = None
    var_samp: Optional[ItemSubCategoriesVarSampField] | None = None
    variance: Optional[ItemSubCategoriesVarianceField] | None = None
