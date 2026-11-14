import { parseSearchDateRange, type SearchDateRange } from '../rental-search.dates';

const CODES = new Set([
  'RENTAL_INSPECTION_STRIPE_WINDOW',
  'RENTAL_STRIPE_BOOKING_WINDOW_EXCEEDED',
]);

export function isCardWindowCode(code: unknown): boolean {
  return typeof code === 'string' && CODES.has(code);
}

/** Friendly EN/FR sentence. Never the raw authorization message. */
export function friendlyCardWindowCopy(input: {
  code: unknown;
  latestCardEndAt: string | null;
  timezone: string;
  locale: string;
}): string | null {
  if (!isCardWindowCode(input.code) || !input.latestCardEndAt) return null;
  const cutoff = formatCardCutoff(input.latestCardEndAt, input.timezone, input.locale);
  if (input.locale.toLowerCase().startsWith('fr')) {
    return `Avec une carte, cette location doit se terminer le ${cutoff}. Choisissez des dates plus tôt.`;
  }
  return `With a card, this rental must end by ${cutoff}. Choose earlier dates.`;
}

export function formatCardCutoff(iso: string, timeZone: string, locale: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone }).format(date);
  const month = monthLabel(date, timeZone, locale);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
  return `${day} ${month} · ${time}`;
}

function monthLabel(date: Date, timeZone: string, locale: string): string {
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone }).format(date);
  return locale.toLowerCase().startsWith('fr') ? month.toLocaleLowerCase('fr') : month;
}

/** Customer sentence. The cutoff is the formatted listing instant, not a fixed date. */
export function assistantCardWindowCopy(cutoff: string, locale: string): string {
  if (locale.toLowerCase().startsWith('fr')) {
    return `Avec une carte, cette location doit se terminer le ${cutoff}. Voici des dates possibles :`;
  }
  return `With a card, this rental must end by ${cutoff}. Here are dates that work:`;
}

/** `13 Nov → 15 Nov · 2 days`. Day count comes from the rental search duration. */
export function formatAssistantStay(
  stay: { start: string; end: string; dayCount: number },
  locale: string
): string {
  const french = locale.toLowerCase().startsWith('fr');
  const unit = french ? (stay.dayCount > 1 ? 'jours' : 'jour') : stay.dayCount > 1 ? 'days' : 'day';
  return `${stayDayLabel(stay.start, locale)} → ${stayDayLabel(stay.end, locale)} · ${stay.dayCount} ${unit}`;
}

/** Earlier stay whose exclusive end is on or before the cutoff. Day count is the search duration. */
export function suggestedCardStay(
  latestIso: string,
  timeZone: string,
  now: Date
): { start: string; end: string; dayCount: number } | null {
  const latestMs = Date.parse(latestIso);
  if (!Number.isFinite(latestMs) || latestMs <= now.getTime()) return null;
  const end = calendarDay(new Date(latestIso), timeZone);
  const start = addIsoDays(calendarDay(now, timeZone), 1);
  const from = start <= end ? start : end;
  return stayOnOrBefore(from, end, latestMs);
}

function calendarDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function stayOnOrBefore(from: string, end: string, latestMs: number) {
  let cursor = end;
  while (cursor > from) {
    const range = searchRange(from, cursor);
    if (range && range.endMs <= latestMs) return pickedStay(range);
    cursor = addIsoDays(cursor, -1);
  }
  return null;
}

function searchRange(start: string, end: string): SearchDateRange | null {
  try {
    return parseSearchDateRange(start, end);
  } catch {
    return null;
  }
}

function pickedStay(range: SearchDateRange) {
  return { start: range.startDate, end: range.endDate, dayCount: range.dayCount };
}

function stayDayLabel(iso: string, locale: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  const french = locale.toLowerCase().startsWith('fr');
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' }).format(date);
  const month = new Intl.DateTimeFormat(french ? 'fr' : 'en-GB', { month: 'short', timeZone: 'UTC' }).format(date);
  const label = french ? month.toLocaleLowerCase('fr') : month.replace(/\./g, '');
  return `${day} ${label}`;
}
