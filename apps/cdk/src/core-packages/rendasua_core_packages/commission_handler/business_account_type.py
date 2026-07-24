"""
Business Account Type — single source of truth for plan tier and item commission.

Commission percentages:
  STANDARD → 12 %
  PREMIUM  → 15 %
  ELITE    → 20 %

Every commission calculation in the system MUST use
get_commission_for_business_account_type(). Do not hardcode percentages elsewhere.
"""

from typing import Optional

STANDARD = "STANDARD"
PREMIUM = "PREMIUM"
ELITE = "ELITE"

BUSINESS_ACCOUNT_TYPES = (STANDARD, PREMIUM, ELITE)

ACCOUNT_TYPE_LOCK_DAYS = 30

_COMMISSION_MAP: dict = {
    STANDARD: 12.0,
    PREMIUM: 15.0,
    ELITE: 20.0,
}


def get_commission_for_business_account_type(
    account_type: Optional[str] = None,
) -> float:
    """Return the item commission percentage for a business account type.

    Falls back to STANDARD (12.0 %) for any unknown or missing value.
    """
    return _COMMISSION_MAP.get(account_type or STANDARD, _COMMISSION_MAP[STANDARD])
