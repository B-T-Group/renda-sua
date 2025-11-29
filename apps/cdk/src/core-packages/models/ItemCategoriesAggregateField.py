from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import ItemCategoriesAvgField, ItemCategoriesMaxField, ItemCategoriesMinField, ItemCategoriesStddevField, ItemCategoriesStddevPopField, ItemCategoriesStddevSampField, ItemCategoriesSumField, ItemCategoriesVarPopField, ItemCategoriesVarSampField, ItemCategoriesVarianceField

class ItemCategoriesAggregateField(BaseModel):
    avg: Optional[ItemCategoriesAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[ItemCategoriesMaxField] | None = None
    min: Optional[ItemCategoriesMinField] | None = None
    stddev: Optional[ItemCategoriesStddevField] | None = None
    stddev_pop: Optional[ItemCategoriesStddevPopField] | None = None
    stddev_samp: Optional[ItemCategoriesStddevSampField] | None = None
    sum: Optional[ItemCategoriesSumField] | None = None
    var_pop: Optional[ItemCategoriesVarPopField] | None = None
    var_samp: Optional[ItemCategoriesVarSampField] | None = None
    variance: Optional[ItemCategoriesVarianceField] | None = None
