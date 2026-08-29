/**
 * Business Account Type — single source of truth for plan tier and item commission.
 *
 * Default / CA commissions:
 *   STANDARD → 12 %
 *   PREMIUM  → 15 %
 *   ELITE    → 20 %
 *
 * CM / GA / TG / BJ / CI / CG commissions:
 *   STANDARD → 7 %
 *   PREMIUM  → 12 %
 *   ELITE    → 15 %
 *
 * Every commission calculation in the system MUST go through
 * getCommissionForBusinessAccountType(). Do not hardcode percentages elsewhere.
 */

export const BusinessAccountType = {
  STANDARD: 'STANDARD',
  PREMIUM: 'PREMIUM',
  ELITE: 'ELITE',
} as const;

export type BusinessAccountType =
  (typeof BusinessAccountType)[keyof typeof BusinessAccountType];

export const BUSINESS_ACCOUNT_TYPE_VALUES = Object.values(
  BusinessAccountType
) as BusinessAccountType[];

/** Number of days a plan selection is locked after a self-serve change. */
export const ACCOUNT_TYPE_LOCK_DAYS = 30;

const DEFAULT_COMMISSION_MAP: Record<BusinessAccountType, number> = {
  STANDARD: 12,
  PREMIUM: 15,
  ELITE: 20,
};

const AFRICA_COMMISSION_MAP: Record<BusinessAccountType, number> = {
  STANDARD: 7,
  PREMIUM: 12,
  ELITE: 15,
};

const COUNTRY_COMMISSION_MAPS: Record<
  string,
  Record<BusinessAccountType, number>
> = {
  CM: AFRICA_COMMISSION_MAP,
  GA: AFRICA_COMMISSION_MAP,
  TG: AFRICA_COMMISSION_MAP,
  BJ: AFRICA_COMMISSION_MAP,
  CI: AFRICA_COMMISSION_MAP,
  CG: AFRICA_COMMISSION_MAP,
};

function normalizeCountry(
  countryCode?: string | null
): string | null {
  if (!countryCode) return null;
  const raw = countryCode.trim().toUpperCase();
  if (raw.length === 2) return raw;
  if (raw === 'CAMEROON') return 'CM';
  if (raw === 'GABON') return 'GA';
  if (raw === 'TOGO') return 'TG';
  if (raw === 'BENIN') return 'BJ';
  if (
    raw === "COTE D'IVOIRE" ||
    raw === "COTE D'IVOIRE (IVORY COAST)" ||
    raw === 'IVORY COAST'
  ) {
    return 'CI';
  }
  if (
    raw === 'CONGO' ||
    raw === 'REPUBLIC OF THE CONGO' ||
    raw === 'REPUBLIC OF CONGO' ||
    raw === 'CONGO-BRAZZAVILLE'
  ) {
    return 'CG';
  }
  if (raw === 'CANADA') return 'CA';
  return raw;
}

/**
 * Returns the commission map for a country (defaults to CA/global rates).
 */
export function getCommissionMapForCountry(
  countryCode?: string | null
): Record<BusinessAccountType, number> {
  const code = normalizeCountry(countryCode);
  if (code && COUNTRY_COMMISSION_MAPS[code]) {
    return COUNTRY_COMMISSION_MAPS[code];
  }
  return DEFAULT_COMMISSION_MAP;
}

/**
 * Returns plan definitions with commission percentages for a country.
 */
export function getAccountTypePlansForCountry(
  countryCode?: string | null
): Array<{ id: BusinessAccountType; commissionPercent: number }> {
  const map = getCommissionMapForCountry(countryCode);
  return BUSINESS_ACCOUNT_TYPE_VALUES.map((id) => ({
    id,
    commissionPercent: map[id],
  }));
}

/**
 * Returns the item commission percentage for a given business account type
 * and country. Falls back to STANDARD rate for any unknown or missing value.
 */
export function getCommissionForBusinessAccountType(
  accountType?: string | null,
  countryCode?: string | null
): number {
  const map = getCommissionMapForCountry(countryCode);
  return (
    map[accountType as BusinessAccountType] ?? map[BusinessAccountType.STANDARD]
  );
}
