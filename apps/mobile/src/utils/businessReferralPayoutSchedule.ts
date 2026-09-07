export type BusinessReferralPayoutSchedule = {
  currency: string;
  catalog10Amount: number;
  catalog10MinSaleTotal: number;
  salePercent: number;
};

const CAD_SCHEDULE: BusinessReferralPayoutSchedule = {
  currency: 'CAD',
  catalog10Amount: 25,
  catalog10MinSaleTotal: 0,
  salePercent: 1,
};

const XAF_SCHEDULE: BusinessReferralPayoutSchedule = {
  currency: 'XAF',
  catalog10Amount: 7500,
  catalog10MinSaleTotal: 2500,
  salePercent: 1,
};

/** Prefer the agent's account country; fall back to the catalog market. */
export function payoutCountryCode(
  accountCountry: string | null | undefined,
  marketCountry: string | null | undefined
): string | undefined {
  const account = accountCountry?.trim().toUpperCase();
  if (account) return account;
  return marketCountry?.trim().toUpperCase() || undefined;
}

/** Country-scoped amounts shown to agents (matches backend compensation defaults). */
export function businessReferralPayoutSchedule(
  countryCode: string | null | undefined
): BusinessReferralPayoutSchedule {
  return countryCode?.toUpperCase() === 'CA' ? CAD_SCHEDULE : XAF_SCHEDULE;
}
