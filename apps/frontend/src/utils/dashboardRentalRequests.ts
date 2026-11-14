import type { BusinessRentalRequestRow, RentalSelectionWindow } from '../hooks/useRentalApi';
import { formatRentalDay } from './rentalRequestFormat';
import { parseRentalSelectionWindows } from './rentalRequestDisplay';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

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
  const code = currency.toUpperCase();
  if (code === 'XAF' || code === 'XOF' || code === 'FCFA') {
    return `${Math.round(amount).toLocaleString(language.startsWith('fr') ? 'fr' : 'en')}\u00A0FCFA`;
  }
  const locale = language.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code.length === 3 ? code : 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function dashboardPeriodLabel(
  windows: RentalSelectionWindow[],
  locale: string,
  allDay: string,
  dayCount: (count: number) => string
): string {
  const days = windows.map((row) => row.calendar_date).filter((day): day is string => Boolean(day)).sort();
  if (days.length === 1 && windows.every((row) => row.billing !== 'hourly')) {
    return `${formatRentalDay(days[0], locale)} · ${allDay}`;
  }
  if (days.length > 1) {
    const end = addUtcDay(days[days.length - 1]);
    return `${formatRentalDay(days[0], locale)} – ${formatRentalDay(end, locale)} · ${dayCount(days.length)}`;
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

export function requestPhotoUrl(row: BusinessRentalRequestRow): string | null {
  const image = row.rental_location_listing.rental_item.rental_item_images?.[0] as
    | { display_url?: string | null; image_url?: string | null; thumbnail?: string | null }
    | undefined;
  return image?.display_url || image?.thumbnail || image?.image_url || null;
}
