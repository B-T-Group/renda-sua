from __future__ import annotations
from pydantic import BaseModel


class BalanceUpdate(BaseModel):
    """Balance update model for transactions."""
    available: float
    withheld: float

