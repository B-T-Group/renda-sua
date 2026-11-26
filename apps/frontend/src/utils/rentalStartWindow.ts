import { listingNowMs } from './rentalDayHoursPicker';
import { pickerLang, uses12h } from './rentalDayHoursCopy';

export type PickupPhase = 'before' | 'today' | 'late' | 'closed' | 'started';

export interface PickupWindowInput {
  now: number;
  startAt: string;
  endAt: string;
  startOpensAt?: string | null;
  timeZone: string;
  started?: boolean;
}

export function pickupPhase(input: PickupWindowInput): PickupPhase {
  if (input.started) return 'started';
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'before';
  const opens = opensAt(input);
  // start/end/opens are listing wall clock stored as UTC components; read now on that clock.
  const now = listingNowMs(input.now, input.timeZone);
  if (now < opens) return 'before';
  if (now >= end) return 'closed';
  if (now > start) return 'late';
  return 'today';
}

/** Booking start/end store listing wall clock in the UTC fields. */
export const BOOKING_CLOCK = 'UTC';

export function opensAt(input: PickupWindowInput): number {
  const given = input.startOpensAt ? Date.parse(input.startOpensAt) : NaN;
  if (Number.isFinite(given)) return given;
  return utcMidnight(input.startAt);
}

export function utcMidnight(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NaN;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function zonedStartOfDay(iso: string, timeZone: string): number {
  const date = new Date(iso);
  const parts = zonedParts(date, timeZone);
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day);
  const adjusted = guess - zoneOffset(new Date(guess), timeZone);
  const landed = zonedParts(new Date(adjusted), timeZone);
  if (landed.day === parts.day) return adjusted;
  return adjusted + (landed.day > parts.day ? -3600000 : 3600000);
}

export function windowStatusLabel(input: {
  phase: PickupPhase;
  photosAsked: boolean;
  day: string;
  t: (key: string, fallback: string, vars?: Record<string, string>) => string;
}): string | null {
  if (input.photosAsked) return input.t('rentals.business.photosPill', 'New photos asked');
  if (input.phase === 'closed') return null;
  if (input.phase === 'before') return input.t('rentals.start.pillDay', 'Pickup {{day}}', { day: input.day });
  if (input.phase === 'late') return input.t('rentals.start.latePickup', 'Late pickup');
  if (input.phase === 'started') return input.t('rentals.journey.inProgress', 'In progress');
  return input.t('rentals.start.pickupToday', 'Pickup today');
}

export function formatZonedDay(iso: string, timeZone: string, language: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  const month = monthName(parts.month, language);
  return `${parts.day} ${month}`;
}

export function formatZonedWeekday(iso: string, timeZone: string, language: string): string {
  const french = language.toLowerCase().startsWith('fr');
  const raw = new Intl.DateTimeFormat(french ? 'fr-CA' : 'en-GB', {
    timeZone,
    weekday: 'short',
  }).format(new Date(iso));
  const clean = raw.replace(/\.$/, '');
  return french ? `${clean.toLowerCase()}.` : clean;
}

/** "Thu 26 Nov" / "jeu. 26 nov." — French keeps the abbreviation dots and joins with non-breaking spaces. */
export function formatZonedWeekdayDay(iso: string, timeZone: string, language: string): string {
  const text = `${formatZonedWeekday(iso, timeZone, language)} ${formatZonedDay(iso, timeZone, language)}`;
  return language.toLowerCase().startsWith('fr') ? text.replace(/ /g, '\u00a0') : text;
}

/**
 * "14:00", or "2:00 PM" when `language` and the listing's `listingZone` are given and that
 * listing uses a 12-hour clock (English in the Americas, same rule as the day-hours picker).
 */
export function formatZonedTime(iso: string, timeZone: string, language?: string, listingZone?: string | null): string {
  const parts = zonedParts(new Date(iso), timeZone);
  if (language && listingZone && uses12h(pickerLang(language), listingZone)) {
    const suffix = parts.hour < 12 ? 'AM' : 'PM';
    return `${parts.hour % 12 || 12}:${pad(parts.minute)} ${suffix}`;
  }
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatPhotoStamp(iso: string, timeZone: string, language: string): string {
  return `${formatZonedDay(iso, timeZone, language)} ${formatZonedTime(iso, timeZone)}`;
}

export function pickupClockLabel(
  actualStartAt: string | null | undefined,
  startAt: string,
  timeZone: string,
  language: string
): string {
  const clock = actualStartAt ? timeZone : BOOKING_CLOCK;
  const iso = actualStartAt || startAt;
  return `${formatZonedDay(iso, clock, language)} ${formatZonedTime(iso, clock, language, timeZone)}`;
}

export function formatZonedWhen(iso: string, timeZone: string, language: string, listingZone?: string | null): string {
  return `${formatZonedWeekdayDay(iso, timeZone, language)} · ${formatZonedTime(iso, timeZone, language, listingZone)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function monthName(month: number, language: string): string {
  const french = language.toLowerCase().startsWith('fr');
  const date = new Date(Date.UTC(2026, month - 1, 15));
  const raw = new Intl.DateTimeFormat(french ? 'fr-CA' : 'en-GB', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
  const clean = raw.replace(/\.$/, '');
  return french ? `${clean.toLowerCase()}.` : clean;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((row) => row.type === type)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') };
}

function zoneOffset(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asUtc - date.getTime();
}
