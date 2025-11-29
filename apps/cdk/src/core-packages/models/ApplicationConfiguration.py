from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel

class ApplicationConfiguration(BaseModel):
    allowed_values: Optional[List[str]] | None = None
    array_value: Optional[List[str]] | None = None
    boolean_value: Optional[bool] | None = None
    config_key: Optional[str] | None = None
    config_name: Optional[str] | None = None
    country_code: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    created_by: Optional[str] | None = None
    data_type: Optional[str] | None = None
    date_value: Optional[datetime.datetime] | None = None
    description: Optional[str] | None = None
    id: Optional[str] | None = None
    json_value: Optional[str] | None = None
    max_value: Optional[float] | None = None
    min_value: Optional[float] | None = None
    number_value: Optional[float] | None = None
    status: Optional[str] | None = None
    string_value: Optional[str] | None = None
    tags: Optional[List[str]] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    updated_by: Optional[str] | None = None
    validation_rules: Optional[str] | None = None
    version: Optional[int] | None = None
