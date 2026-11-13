/**
 * One decision for card rentals: authorize the whole stay up front, or charge
 * the contract at pickup and hold only the deposit.
 *
 * `latest_card_end_at` is the latest rental end that still satisfies
 * `endAt + reviewHours <= now + authWindowDays`. It is null when charge at
 * pickup applies, because that path is not limited by the 6-day authorization.
 *
 * The in-flight card date guard (agent bc-7caa3370) should read this helper.
 * It was not on main when this landed.
 */

export const CARD_PAYMENT_MODES = ['authorize_upfront', 'charge_at_pickup'] as const;
export type CardPaymentMode = (typeof CARD_PAYMENT_MODES)[number];

export const CHARGE_AT_PICKUP_FLAG = 'rentals_card_charge_at_pickup_enabled';

const DEFAULT_REVIEW_HOURS = 72;
const DEFAULT_AUTH_WINDOW_DAYS = 6;

export interface ResolveCardPaymentPolicyInput {
  rail: string;
  inspected: boolean;
  chargeAtPickupEnabled: boolean;
  alreadyAuthorized?: boolean;
  endAt?: Date | null;
  now?: Date;
  reviewHours?: number;
  authWindowDays?: number;
  timezone?: string | null;
}

export interface CardPaymentPolicy {
  mode: CardPaymentMode;
  latest_card_end_at: string | null;
  payment_rail: string;
  momo_available: boolean;
  stripe_review_hours: number;
  timezone: string | null;
}

export function chargeAtPickupApplies(input: ResolveCardPaymentPolicyInput): boolean {
  if (!input.chargeAtPickupEnabled || !input.inspected) return false;
  if (input.rail !== 'stripe' || input.alreadyAuthorized) return false;
  return true;
}

export function resolveCardPaymentPolicy(
  input: ResolveCardPaymentPolicyInput
): CardPaymentPolicy {
  const reviewHours = input.reviewHours ?? DEFAULT_REVIEW_HOURS;
  const mode: CardPaymentMode = chargeAtPickupApplies(input)
    ? 'charge_at_pickup'
    : 'authorize_upfront';
  return {
    mode,
    latest_card_end_at: latestEndIso(input, mode, reviewHours),
    payment_rail: input.rail,
    momo_available: input.rail !== 'stripe',
    stripe_review_hours: reviewHours,
    timezone: input.timezone ?? null,
  };
}

function latestEndIso(
  input: ResolveCardPaymentPolicyInput,
  mode: CardPaymentMode,
  reviewHours: number
): string | null {
  if (mode === 'charge_at_pickup' || input.rail !== 'stripe') return null;
  const now = input.now ?? new Date();
  const authDays = input.authWindowDays ?? DEFAULT_AUTH_WINDOW_DAYS;
  const latest = now.getTime() + authDays * 86400000 - reviewHours * 3600000;
  return new Date(latest).toISOString();
}
