"""Percentage cancellation fee (single definition shared with the NestJS backend).

Mirror of ``apps/backend/src/orders/fee-percent.util.ts``. Both sides compute:

    fee = cancellation_fee_percent % of the ITEM SUBTOTAL AFTER DISCOUNTS

where the base excludes the delivery fee, tax, and the Rendasua service fee:

    base = max(0, total_amount - collected_delivery_fee - tax_amount - service_fee)

``total_amount`` is what the client is charged (items + delivery + service fee + tax -
discount code - purchase credits), so every discount is already netted out;
``collected_delivery_fee`` is 0 when the fee was waived. Rounding is half-up to the
currency minor unit (XAF/XOF whole units, others 2 decimals). Keep the test vectors in
``tests/test_cancellation_fee_util.py`` and ``fee-percent.util.spec.ts`` identical.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_FEE_PERCENT = 30.0

CANCELLATION_FEE_PERCENT_KEY = "cancellation_fee_percent"

_ZERO_DECIMAL_CURRENCIES = {
    "XAF", "XOF", "JPY", "KRW", "VND", "CLP", "UGX", "RWF", "BIF", "DJF",
    "KMF", "GNF", "PYG", "VUV", "XPF",
}

_COUNTRY_NAME_TO_CODE = {
    "CAMEROON": "CM",
    "CAMEROUN": "CM",
    "GABON": "GA",
    "CANADA": "CA",
    "TOGO": "TG",
    "BENIN": "BJ",
    "BÉNIN": "BJ",
    "COTE D'IVOIRE": "CI",
    "CÔTE D'IVOIRE": "CI",
    "IVORY COAST": "CI",
    "CONGO": "CG",
    "PHILIPPINES": "PH",
    "UNITED STATES": "US",
    "USA": "US",
}


class InvalidFeePercentError(ValueError):
    """A fee percent row exists but its value is NULL / not a number / outside 0-100."""


def currency_decimals(currency: Optional[str]) -> int:
    return 0 if str(currency or "").upper() in _ZERO_DECIMAL_CURRENCIES else 2


def normalize_fee_country_code(country: Optional[str]) -> Optional[str]:
    """ISO alpha-2 code from a code or a known country name; None when unknown."""
    raw = str(country or "").strip().upper()
    if not raw:
        return None
    if len(raw) == 2:
        return raw
    return _COUNTRY_NAME_TO_CODE.get(raw)


def _num(value: Any) -> Decimal:
    try:
        d = Decimal(str(value if value is not None else 0))
    except Exception:
        return Decimal(0)
    return d if d.is_finite() else Decimal(0)


def item_subtotal_after_discounts(
    total_amount: Any,
    base_delivery_fee: Any = 0,
    per_km_delivery_fee: Any = 0,
    delivery_fee_waived: Optional[bool] = False,
    tax_amount: Any = 0,
    service_fee: Any = 0,
) -> float:
    """max(0, total - delivery actually paid - tax - service fee), 2-decimal half-up."""
    delivery = (
        Decimal(0)
        if delivery_fee_waived
        else _num(base_delivery_fee) + _num(per_km_delivery_fee)
    )
    base = _num(total_amount) - delivery - _num(tax_amount) - _num(service_fee)
    if base <= 0:
        return 0.0
    return float(base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def percent_fee(base: float, percent: float, currency: Optional[str]) -> float:
    """``percent``% of ``base`` rounded half-up to the currency minor unit."""
    if not (base > 0) or not (percent > 0):
        return 0.0
    decimals = currency_decimals(currency)
    factor = Decimal(10) ** decimals
    base_minor = (Decimal(str(base)) * factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    basis_points = (Decimal(str(percent)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    fee_minor = (base_minor * basis_points + 5000) // 10000
    return float(fee_minor / factor)


def split_cancellation_fee(fee: float, currency: Optional[str]) -> Tuple[float, float]:
    """Merchant gets floor(fee / 2); the platform keeps the remainder (odd minor unit).

    Mirror of ``splitCancellationFee`` in ``fee-percent.util.ts``.
    """
    if not (fee > 0):
        return 0.0, 0.0
    factor = Decimal(10) ** currency_decimals(currency)
    fee_minor = int((Decimal(str(fee)) * factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    merchant_minor = fee_minor // 2
    platform_minor = fee_minor - merchant_minor
    return float(Decimal(merchant_minor) / factor), float(Decimal(platform_minor) / factor)


def _valid_percent(value: Any, where: str) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise InvalidFeePercentError(f"Invalid fee percent ({value!r}) for {where}: expected 0-100")
    if value is None or value == "" or n != n or n < 0 or n > 100:
        raise InvalidFeePercentError(f"Invalid fee percent ({value!r}) for {where}: expected 0-100")
    return n


def select_fee_percent(
    rows: List[Dict[str, Any]], country_code: Optional[str]
) -> Tuple[float, str]:
    """Pick ``(percent, source)`` from active ``application_configurations`` rows.

    1. row for the country (an explicit 0 is honoured: Canada) -> source ``country``
    2. else the global row (country_code NULL)              -> source ``global``
    3. else ``DEFAULT_FEE_PERCENT``                          -> source ``missing_default``
       (callers MUST log this at error level: never a silent 0, never a silent default)
    An existing row with an invalid value raises ``InvalidFeePercentError``.
    """
    country = country_code.upper() if country_code else None
    if country:
        for r in rows:
            if str(r.get("country_code") or "").upper() == country:
                return _valid_percent(r.get("number_value"), f"country {country}"), "country"
    for r in rows:
        if not r.get("country_code"):
            return _valid_percent(r.get("number_value"), "global default"), "global"
    return DEFAULT_FEE_PERCENT, "missing_default"
