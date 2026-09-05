/** African CFA markets that share the CM/GA per-km delivery fallback. */
export const CFA_DELIVERY_FALLBACK_COUNTRIES = [
  'CM',
  'GA',
  'TG',
  'BJ',
  'CI',
  'CG',
] as const;

export type CfaDeliveryFallbackCountry =
  (typeof CFA_DELIVERY_FALLBACK_COUNTRIES)[number];

export type DeliveryFeeFallback = {
  baseFee: number;
  perKmFee: number;
  totalFee: number;
};

export function isCfaDeliveryFallbackCountry(
  countryCode: string | null | undefined
): boolean {
  const code = String(countryCode || '').trim().toUpperCase();
  return (CFA_DELIVERY_FALLBACK_COUNTRIES as readonly string[]).includes(code);
}

/**
 * Hardcoded fee when country_delivery_configs lookup fails.
 * CFA: 100/km capped at 1500. Other markets: 200/km with no per-km cap
 * (so per-km is 0) and a 1000 minimum total.
 */
export function calculateDeliveryFeeFallback(params: {
  distanceKm: number;
  countryCode: string;
  requiresFastDelivery?: boolean;
}): DeliveryFeeFallback {
  const isCfaMarket = isCfaDeliveryFallbackCountry(params.countryCode);
  const baseFee = params.requiresFastDelivery ? 1500 : 1000;
  const perKmFee = Math.min(
    isCfaMarket ? 1500 : 0,
    params.distanceKm * (isCfaMarket ? 100 : 200)
  );
  return {
    baseFee,
    perKmFee,
    totalFee: Math.max(1000, baseFee + perKmFee),
  };
}
