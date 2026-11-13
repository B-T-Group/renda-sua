import { DateTime } from 'luxon';
import { parseSearchDateRange } from './rental-search.dates';
import {
  DEFAULT_STRIPE_REVIEW_HOURS,
  STRIPE_AUTH_WINDOW_DAYS,
  stripeReviewFits,
} from './inspection/rental-inspection.policy';

export type CardPaymentRail = 'stripe' | 'mobile_money';
export type CardPaymentMode = 'authorize_upfront' | 'charge_at_pickup';

/** Shared with the card date guard. latest_card_end_at is null when the window does not apply. */
export interface CardPaymentPolicy {
  mode: CardPaymentMode;
  latest_card_end_at: string | null;
  payment_rail: CardPaymentRail;
  momo_available: boolean;
  stripe_review_hours: number;
  timezone: string;
}

export type CardWindowFields = CardPaymentPolicy;

/** Policy plus the listing fields the date picker already reads. */
export interface ListingCardWindow extends CardPaymentPolicy {
  inspection_enabled: boolean;
  card_auth_window_days: number;
}

export interface CardWindowOffer {
  startDate: string;
  endDate: string;
  dayCount: number;
}

/** Latest end instant that still satisfies end + review <= now + auth window. */
export function latestCardEndAt(
  now: Date,
  reviewHours = DEFAULT_STRIPE_REVIEW_HOURS,
  authWindowDays = STRIPE_AUTH_WINDOW_DAYS
): Date {
  const reviewMs = reviewHours * 3_600_000;
  const authMs = authWindowDays * 86_400_000;
  return new Date(now.getTime() + authMs - reviewMs);
}

export function resolveCardPaymentPolicy(input: {
  rail: CardPaymentRail;
  timezone: string;
  now?: Date;
  reviewHours?: number;
  authWindowDays?: number;
  /** Use a value already on the payload. Recompute when it is absent. */
  latestCardEndAt?: string | null;
  chargeAtPickupEnabled?: boolean;
  /** True when this booking is on the inspection policy, or a new one would be. */
  inspected?: boolean;
}): CardPaymentPolicy {
  const reviewHours = input.reviewHours ?? DEFAULT_STRIPE_REVIEW_HOURS;
  const chargeAtPickup =
    input.chargeAtPickupEnabled === true && input.inspected === true && input.rail === 'stripe';
  const mode: CardPaymentMode = chargeAtPickup ? 'charge_at_pickup' : 'authorize_upfront';
  return {
    mode,
    latest_card_end_at: upfrontLatest(input, mode, reviewHours),
    payment_rail: input.rail,
    momo_available: input.rail === 'mobile_money',
    stripe_review_hours: reviewHours,
    timezone: input.timezone,
  };
}

export function cardWindowFields(input: {
  now: Date;
  rail: CardPaymentRail;
  timezone: string;
  reviewHours?: number;
  authWindowDays?: number;
  latestCardEndAt?: string | null;
  chargeAtPickupEnabled?: boolean;
  inspected?: boolean;
}): CardPaymentPolicy {
  return resolveCardPaymentPolicy(input);
}

function upfrontLatest(
  input: { now?: Date; rail: CardPaymentRail; authWindowDays?: number; latestCardEndAt?: string | null },
  mode: CardPaymentMode,
  reviewHours: number
): string | null {
  if (mode !== 'authorize_upfront' || input.rail !== 'stripe') return null;
  const provided = parseInstant(input.latestCardEndAt);
  const computed = latestCardEndAt(input.now ?? new Date(), reviewHours, input.authWindowDays);
  return (provided ?? computed).toISOString();
}

export function readLatestCardEndAt(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as { latest_card_end_at?: unknown }).latest_card_end_at;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

export function listingCountryCode(
  listing: { business_location?: { address?: { country?: string | null } } },
  fallback?: string | null
): string {
  const country = listing.business_location?.address?.country || fallback || '';
  return country.trim().toUpperCase();
}

/** Exclusive end date whose local midnight is still on or before latest_card_end_at. */
export function latestExclusiveEndDate(latestIso: string, zone: string): string {
  const latest = DateTime.fromISO(latestIso, { zone: 'utc' }).setZone(zone);
  let midnight = latest.startOf('day');
  if (midnight.toMillis() > latest.toMillis()) midnight = midnight.minus({ days: 1 });
  return midnight.toFormat('yyyy-MM-dd');
}

export function exclusiveEndInstant(endDate: string, zone: string): Date {
  return DateTime.fromISO(endDate, { zone }).startOf('day').toJSDate();
}

export function clampExclusiveRange(input: {
  startDate: string;
  endDate: string;
  dayCount: number;
  latestCardEndAt: string | null;
  zone: string;
  today: string;
}): { fits: boolean; offer: CardWindowOffer | null } {
  if (!input.latestCardEndAt) return { fits: true, offer: ranged(input.startDate, input.endDate) };
  const cap = latestExclusiveEndDate(input.latestCardEndAt, input.zone);
  if (input.endDate <= cap && input.startDate >= input.today && input.startDate < input.endDate) {
    return { fits: true, offer: ranged(input.startDate, input.endDate) };
  }
  const start = input.startDate < cap ? laterDate(input.startDate, input.today) : addDays(cap, -1);
  if (start < input.today || start >= cap) return { fits: false, offer: null };
  const offer = ranged(start, cap);
  if (!offer) return { fits: false, offer: null };
  return { fits: false, offer };
}

function ranged(startDate: string, endDate: string): CardWindowOffer | null {
  const dayCount = rentalDurationDays(startDate, endDate);
  if (!dayCount) return null;
  return { startDate, endDate, dayCount };
}

function rentalDurationDays(start: string, end: string): number | null {
  try {
    return parseSearchDateRange(start, end)?.dayCount ?? null;
  } catch {
    return null;
  }
}

function laterDate(left: string, right: string): string {
  return left > right ? left : right;
}

function addDays(iso: string, days: number): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).plus({ days }).toFormat('yyyy-MM-dd');
}

function parseInstant(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cardRailFits(endAt: Date, now: Date, reviewHours?: number): boolean {
  return stripeReviewFits({ endAt, now, reviewHours });
}
