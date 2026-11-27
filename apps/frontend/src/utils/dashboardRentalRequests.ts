import { listingNowMs } from './rentalDayHoursPicker';
import type { BusinessRentalRequestRow, RentalSelectionWindow } from '../hooks/useRentalApi';
import { appendReturnDay, formatRentalDay } from './rentalRequestFormat';
import { formatRequestAmount, parseRentalSelectionWindows } from './rentalRequestDisplay';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const CONTRACT_HOUR_CAP = 48;
export const TOTAL_OVERRIDE_RATIO = 10;

/** Rebate taken off the quote. Empty means no rebate. Returns the new total, or 'invalid'. */
export function rebateToTotal(raw: string, quote: number): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const rebate = Number(trimmed);
  if (!Number.isFinite(rebate) || rebate <= 0) return 'invalid';
  const next = Number((quote - rebate).toFixed(2));
  return next > 0 ? next : 'invalid';
}

export function totalOverrideTooHigh(quote: number, value: number, ceiling: number | null = null): boolean {
  if (!(value > quote)) return false;
  if (ceiling != null && value > ceiling) return true;
  if (!(quote > 0)) return false;
  return value > quote * TOTAL_OVERRIDE_RATIO;
}

/** `timeZone` is the listing zone: startIso is its wall clock stored as UTC components. */
export function contractHoursOffer(startIso: string | null, now = new Date(), timeZone?: string | null): {
  hidden: boolean;
  hours: number;
  maxHours: number;
} {
  const remaining = hoursUntil(startIso, now, timeZone);
  if (remaining == null) return { hidden: false, hours: CONTRACT_HOUR_CAP, maxHours: CONTRACT_HOUR_CAP };
  if (remaining < 1) return { hidden: true, hours: Math.max(0, remaining), maxHours: 0 };
  const maxHours = Math.min(CONTRACT_HOUR_CAP, Math.floor(remaining));
  return { hidden: false, hours: maxHours, maxHours };
}

function hoursUntil(startIso: string | null, now: Date, timeZone?: string | null): number | null {
  if (!startIso) return null;
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return null;
  return (start - listingNowMs(now.getTime(), timeZone)) / HOUR_MS;
}

export function respondWithinHours(respondBy: string, now = Date.now()): number {
  const ms = Date.parse(respondBy) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / HOUR_MS);
}

export function respondWithinAmber(respondBy: string, now = Date.now()): boolean {
  const ms = Date.parse(respondBy) - now;
  return ms > 0 && ms < 4 * HOUR_MS;
}

export function respondWindow(createdAt: string, startAt: string | null): 'sla' | 'start' {
  const created = Date.parse(createdAt);
  const sla = (Number.isFinite(created) ? created : Date.now()) + DAY_MS;
  const start = startAt ? Date.parse(startAt) : Number.NaN;
  return Number.isFinite(start) && start < sla ? 'start' : 'sla';
}

export function requestStartIso(row: {
  rental_selection_windows?: RentalSelectionWindow[] | null;
  requested_start_at?: string | null;
}): string | null {
  const windows = parseRentalSelectionWindows(row.rental_selection_windows);
  if (windows[0]?.start_at) return windows[0].start_at;
  return row.requested_start_at ?? null;
}

export function compareSoonestRequestStart(
  a: { created_at: string; rental_selection_windows?: RentalSelectionWindow[] | null; requested_start_at?: string | null },
  b: { created_at: string; rental_selection_windows?: RentalSelectionWindow[] | null; requested_start_at?: string | null }
): number {
  const delta = startMs(a) - startMs(b);
  if (delta !== 0) return delta;
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

function startMs(row: { rental_selection_windows?: RentalSelectionWindow[] | null; requested_start_at?: string | null }): number {
  const iso = requestStartIso(row);
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function youReceiveAmount(row: BusinessRentalRequestRow): number | null {
  if (row.quoted_total != null && row.quoted_total !== '') {
    const quoted = Number(row.quoted_total);
    if (Number.isFinite(quoted)) return quoted;
  }
  return null;
}

export function formatYouReceive(amount: number, currency: string, language: string): string {
  return formatRequestAmount(amount, currency, language);
}

export function dashboardPeriodLabel(
  windows: RentalSelectionWindow[],
  locale: string,
  allDay: string,
  dayCount: (count: number) => string
): string {
  const days = windows.map((row) => row.calendar_date).filter((day): day is string => Boolean(day)).sort();
  if (days.length === 1 && windows.every((row) => row.billing !== 'hourly')) {
    return appendReturnDay(`${formatRentalDay(days[0], locale)} · ${allDay}`, addUtcDay(days[0]), locale);
  }
  if (days.length > 1) {
    const last = days[days.length - 1];
    return appendReturnDay(
      `${formatRentalDay(days[0], locale)} – ${formatRentalDay(last, locale)} · ${dayCount(days.length)}`,
      addUtcDay(last),
      locale
    );
  }
  return windows[0]?.start_at ? formatRentalDay(windows[0].start_at.slice(0, 10), locale) : '';
}

function addUtcDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function startInDays(calendarDate: string | undefined, timeZone: string, now = new Date()): number | null {
  if (!calendarDate) return null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = Date.parse(`${calendarDate}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(todayMs)) return null;
  return Math.round((start - todayMs) / DAY_MS);
}
