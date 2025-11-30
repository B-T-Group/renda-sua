from __future__ import annotations
from typing import TYPE_CHECKING
from pydantic import BaseModel

if TYPE_CHECKING:
    from .BalanceUpdate import BalanceUpdate


class TransactionInfo(BaseModel):
    """Transaction info model."""
    isCredit: bool
    balanceUpdate: "BalanceUpdate"

