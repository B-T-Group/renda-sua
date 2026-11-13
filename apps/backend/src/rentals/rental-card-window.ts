import { DateTime } from 'luxon';
import {
  DEFAULT_STRIPE_REVIEW_HOURS,
  STRIPE_AUTH_WINDOW_DAYS,
  stripeReviewFits,
} from './inspection/rental-inspection.policy';

export type CardPaymentRail = 'stripe' | 'mobile_money';

/** Field names shared with the card date guard. */
export interface CardWindowFields {
  latest_card_end_at: string;
  payment_rail: CardPaymentRail;
  momo_available: boolean;
  stripe_review_hours: number;
  timezone: string;
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

export function cardWindowFields(input: {
  now: Date;
  rail: CardPaymentRail;
  timezone: string;
  reviewHours?: number;
  authWindowDays?: number;
  /** Use a value already on the payload. Recompute when it is absent. */
  latestCardEndAt?: string | null;
}): CardWindowFields {
  const reviewHours = input.reviewHours ?? DEFAULT_STRIPE_REVIEW_HOURS;
  const computed = latestCardEndAt(input.now, reviewHours, input.authWindowDays);
  const provided = parseInstant(input.latestCardEndAt);
  return {
    latest_card_end_at: (provided ?? computed).toISOString(),
    payment_rail: input.rail,
    momo_available: input.rail === 'mobile_money',
    stripe_review_hours: reviewHours,
    timezone: input.timezone,
  };
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
  latestCardEndAt: string;
  zone: string;
  today: string;
}): { fits: boolean; offer: CardWindowOffer | null } {
  const cap = latestExclusiveEndDate(input.latestCardEndAt, input.zone);
  if (input.endDate <= cap && input.startDate >= input.today && input.startDate < input.endDate) {
    return { fits: true, offer: rangeOf(input.startDate, input.endDate, input.dayCount) };
  }
  const start = input.startDate < cap ? laterDate(input.startDate, input.today) : addDays(cap, -1);
  const days = dayCount(start, cap);
  if (start < input.today || start >= cap || !days || days < 1) return { fits: false, offer: null };
  return { fits: false, offer: rangeOf(start, cap, days) };
}

function rangeOf(startDate: string, endDate: string, dayCount: number): CardWindowOffer {
  return { startDate, endDate, dayCount };
}

function laterDate(left: string, right: string): string {
  return left > right ? left : right;
}

function addDays(iso: string, days: number): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).plus({ days }).toFormat('yyyy-MM-dd');
}

function dayCount(start: string, end: string): number | null {
  const days = DateTime.fromISO(end).diff(DateTime.fromISO(start), 'days').days;
  return Number.isFinite(days) ? Math.round(days) : null;
}

function parseInstant(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cardRailFits(endAt: Date, now: Date, reviewHours?: number): boolean {
  return stripeReviewFits({ endAt, now, reviewHours });
}
