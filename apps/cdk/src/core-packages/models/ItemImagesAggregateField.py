from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import ItemImagesAvgField, ItemImagesMaxField, ItemImagesMinField, ItemImagesStddevField, ItemImagesStddevPopField, ItemImagesStddevSampField, ItemImagesSumField, ItemImagesVarPopField, ItemImagesVarSampField, ItemImagesVarianceField

class ItemImagesAggregateField(BaseModel):
    avg: Optional[ItemImagesAvgField] | None = None
    count: Optional[int] | None = None
    max: Optional[ItemImagesMaxField] | None = None
    min: Optional[ItemImagesMinField] | None = None
    stddev: Optional[ItemImagesStddevField] | None = None
    stddev_pop: Optional[ItemImagesStddevPopField] | None = None
    stddev_samp: Optional[ItemImagesStddevSampField] | None = None
    sum: Optional[ItemImagesSumField] | None = None
    var_pop: Optional[ItemImagesVarPopField] | None = None
    var_samp: Optional[ItemImagesVarSampField] | None = None
    variance: Optional[ItemImagesVarianceField] | None = None
