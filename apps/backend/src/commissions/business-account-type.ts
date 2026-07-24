/**
 * Business Account Type — single source of truth for plan tier and item commission.
 *
 * Commission percentages:
 *   STANDARD → 12 %
 *   PREMIUM  → 15 %
 *   ELITE    → 20 %
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

const COMMISSION_MAP: Record<BusinessAccountType, number> = {
  STANDARD: 12,
  PREMIUM: 15,
  ELITE: 20,
};

/**
 * Returns the item commission percentage for a given business account type.
 * Falls back to STANDARD (12 %) for any unknown or missing value.
 */
export function getCommissionForBusinessAccountType(
  accountType?: string | null
): number {
  return (
    COMMISSION_MAP[accountType as BusinessAccountType] ??
    COMMISSION_MAP.STANDARD
  );
}
