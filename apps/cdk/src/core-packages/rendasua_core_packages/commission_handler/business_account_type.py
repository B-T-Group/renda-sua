"""
Business Account Type — single source of truth for plan tier and item commission.

Default / CA commissions:
  STANDARD → 12 %
  PREMIUM  → 15 %
  ELITE    → 20 %

CM / GA commissions:
  STANDARD → 7 %
  PREMIUM  → 12 %
  ELITE    → 15 %

Every commission calculation in the system MUST use
get_commission_for_business_account_type(). Do not hardcode percentages elsewhere.
"""

from typing import Optional

STANDARD = "STANDARD"
PREMIUM = "PREMIUM"
ELITE = "ELITE"

BUSINESS_ACCOUNT_TYPES = (STANDARD, PREMIUM, ELITE)

ACCOUNT_TYPE_LOCK_DAYS = 30

_DEFAULT_COMMISSION_MAP: dict = {
    STANDARD: 12.0,
    PREMIUM: 15.0,
    ELITE: 20.0,
}

_AFRICA_COMMISSION_MAP: dict = {
    STANDARD: 7.0,
    PREMIUM: 12.0,
    ELITE: 15.0,
}

_COUNTRY_COMMISSION_MAPS: dict = {
    "CM": _AFRICA_COMMISSION_MAP,
    "GA": _AFRICA_COMMISSION_MAP,
}


def _normalize_country(country_code: Optional[str] = None) -> Optional[str]:
    if not country_code:
        return None
    raw = country_code.strip().upper()
    if len(raw) == 2:
        return raw
    aliases = {
        "CAMEROON": "CM",
        "GABON": "GA",
        "CANADA": "CA",
    }
    return aliases.get(raw, raw)


def get_commission_map_for_country(country_code: Optional[str] = None) -> dict:
    code = _normalize_country(country_code)
    if code and code in _COUNTRY_COMMISSION_MAPS:
        return _COUNTRY_COMMISSION_MAPS[code]
    return _DEFAULT_COMMISSION_MAP


def get_commission_for_business_account_type(
    account_type: Optional[str] = None,
    country_code: Optional[str] = None,
) -> float:
    """Return the item commission percentage for a business account type and country.

    Falls back to STANDARD rate for any unknown or missing value.
    """
    commission_map = get_commission_map_for_country(country_code)
    return commission_map.get(account_type or STANDARD, commission_map[STANDARD])
