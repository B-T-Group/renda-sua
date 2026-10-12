export interface CappedDeliveryFee {
  baseFee: number;
  perKmFee: number;
  totalFee: number;
}

export interface CapDeliveryFeeInput {
  baseFee: number;
  perKmRate: number;
  distanceKm: number;
  /** 0 means the total cap is not configured. */
  maxDeliveryFee: number;
  /** Used only when maxDeliveryFee is unset. Caps the per-km slice. */
  maxPerKmFee: number;
}

const roundCurrency = (amount: number): number =>
  Math.round(amount * 100) / 100;

/** Distance the normal base and per-km rate can cover before the total cap. */
export function maxClientDistanceKm(
  normalBase: number,
  perKmRate: number,
  maxDeliveryFee: number
): number | null {
  if (!(maxDeliveryFee > 0) || !(perKmRate > 0)) return null;
  return Math.max(0, (maxDeliveryFee - normalBase) / perKmRate);
}

export function isBeyondFeeRange(
  distanceKm: number,
  maxClientKm: number | null
): boolean {
  if (maxClientKm == null) return false;
  return distanceKm > maxClientKm;
}

export function shouldWaiveDeliveryFee(params: {
  distanceKm: number;
  maxClientKm: number | null;
  commissionAmount: number;
  threshold: number;
}): boolean {
  if (!(params.threshold > 0) || params.maxClientKm == null) return false;
  if (isBeyondFeeRange(params.distanceKm, params.maxClientKm)) return false;
  return params.commissionAmount >= params.threshold;
}

/** Trim the per-km slice first so base + per-km still equals the capped total. */
export function capDeliveryFee(input: CapDeliveryFeeInput): CappedDeliveryFee {
  const distanceKm = Math.max(0, input.distanceKm);
  const perKmRate = Math.max(0, input.perKmRate);
  const baseFee = Math.max(0, input.baseFee);
  if (input.maxDeliveryFee > 0) {
    return capToMaxTotal(baseFee, distanceKm * perKmRate, input.maxDeliveryFee);
  }
  const perKmFee = Math.min(Math.max(0, input.maxPerKmFee), distanceKm * perKmRate);
  return rounded(baseFee, perKmFee);
}

function capToMaxTotal(
  baseFee: number,
  perKmFee: number,
  maxDeliveryFee: number
): CappedDeliveryFee {
  const total = baseFee + perKmFee;
  if (total <= maxDeliveryFee) return rounded(baseFee, perKmFee);
  const overflow = total - maxDeliveryFee;
  if (perKmFee >= overflow) return rounded(baseFee, perKmFee - overflow);
  return rounded(maxDeliveryFee, 0);
}

function rounded(baseFee: number, perKmFee: number): CappedDeliveryFee {
  const base = roundCurrency(baseFee);
  const perKm = roundCurrency(perKmFee);
  return { baseFee: base, perKmFee: perKm, totalFee: roundCurrency(base + perKm) };
}

const COUNTRY_NAMES: Record<string, string> = {
  CAMEROON: 'CM',
  CAMEROUN: 'CM',
  GABON: 'GA',
  CANADA: 'CA',
  TOGO: 'TG',
  BENIN: 'BJ',
  'BÉNIN': 'BJ',
  "COTE D'IVOIRE": 'CI',
  "CÔTE D'IVOIRE": 'CI',
  'IVORY COAST': 'CI',
  CONGO: 'CG',
  PHILIPPINES: 'PH',
};

/** Customer pays 0. Stored base is restored so the agent is paid the pre-waiver fee. */
export function waivedCustomerDeliveryFee(info: {
  baseDeliveryFeeBeforeDiscount: number;
  perKmDeliveryFee: number;
}): {
  deliveryFee: number;
  deliveryFeeBeforeWaiver: number;
  baseDeliveryFee: number;
  firstOrderDeliveryFeePromo: boolean;
  firstOrderBaseDeliveryDiscountAmount: number;
} {
  const before = roundCurrency(
    info.baseDeliveryFeeBeforeDiscount + info.perKmDeliveryFee
  );
  return {
    deliveryFee: 0,
    deliveryFeeBeforeWaiver: before,
    baseDeliveryFee: info.baseDeliveryFeeBeforeDiscount,
    firstOrderDeliveryFeePromo: false,
    firstOrderBaseDeliveryDiscountAmount: 0,
  };
}

/** Fee the customer actually paid. Waived orders keep base and per-km for agent pay. */
export function collectedDeliveryFee(order: {
  base_delivery_fee?: number | string | null;
  per_km_delivery_fee?: number | string | null;
  delivery_fee_waived?: boolean | null;
}): number {
  if (order.delivery_fee_waived) return 0;
  return Number(order.base_delivery_fee ?? 0) + Number(order.per_km_delivery_fee ?? 0);
}

/** ISO code, or a known country name. Unknown text stays as entered. */
export function comparableCountry(value?: string | null): string | null {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return COUNTRY_NAMES[raw] ?? raw;
}

/** ISO alpha-2 when the value is a code or a known market name; otherwise null. */
export function isoCountryCode(value?: string | null): string | null {
  const mapped = comparableCountry(value);
  return mapped && /^[A-Z]{2}$/.test(mapped) ? mapped : null;
}

export function normalizeDeliveryCountryCode(
  country: string | null | undefined
): string {
  const raw = String(country || '').trim().toUpperCase();
  if (raw.length === 2) return raw;
  return COUNTRY_NAMES[raw] ?? (raw.length >= 2 ? raw.slice(0, 2) : 'GA');
}
