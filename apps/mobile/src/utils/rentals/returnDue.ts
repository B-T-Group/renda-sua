import { listingNowMs } from './dayHoursPicker';

/**
 * Hourly early start (Samuel, 26 Nov 2026): a single hourly booking started before its
 * booked start is due back at start + booked hours (14:00-16:00 started at 11:00 is
 * due at 13:00). The server stamps return_due_at when the rental starts; this file
 * reads it and previews the same rule on the Start sheet. Times are listing wall clock
 * stored as UTC components, like start_at / end_at.
 */

export interface ReturnDueFields {
  start_at?: string | null;
  end_at?: string | null;
  return_due_at?: string | null;
  rental_pricing_snapshot?: unknown;
}

export interface EarlyReturnPreview {
  /** Listing wall clock, UTC components. */
  dueAt: string;
  /** Booked length, the time from now until due. */
  durationMs: number;
}

/** The stored return due: return_due_at after an hourly early start, else end_at. */
export function bookingReturnDue(booking: ReturnDueFields | null | undefined): string | null {
  return booking?.return_due_at || booking?.end_at || null;
}

export function isSingleHourlyBooking(snapshot: unknown): boolean {
  const lines = (snapshot as { lines?: Array<{ kind?: string } | null> } | null | undefined)?.lines;
  return Array.isArray(lines) && lines.length === 1 && lines[0]?.kind === 'hourly';
}

/** What the server would stamp if the rental started at `now`; null keeps the booked end. */
export function earlyReturnPreview(
  booking: ReturnDueFields | null | undefined,
  now: number,
  timeZone: string
): EarlyReturnPreview | null {
  const start = Date.parse(String(booking?.start_at ?? ''));
  const end = Date.parse(String(booking?.end_at ?? ''));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (!isSingleHourlyBooking(booking?.rental_pricing_snapshot)) return null;
  if (listingNowMs(now, timeZone) >= start) return null;
  const durationMs = end - start;
  const due = Math.min(listingNowMs(now + durationMs, timeZone), end);
  return { dueAt: new Date(due).toISOString(), durationMs };
}

/** "1:00 PM" in English, "13:00" in French, read on the stored wall clock. */
export function formatReturnClock(wallIso: string, language: string): string {
  const date = new Date(wallIso);
  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  if (language.toLowerCase().startsWith('fr')) return `${String(hours).padStart(2, '0')}:${minutes}`;
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

/** "2 h", "1 h 30 min", "45 min" (same in English and French). */
export function formatReturnDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

/** "Return by 1:00 PM (2 h from now)" / "Retour avant 13:00 (dans 2 h)". */
export function earlyReturnLine(preview: EarlyReturnPreview, language: string, t: Translate): string {
  return t('rentals.start.returnByEarly', 'Return by {{time}} ({{duration}} from now)', {
    time: formatReturnClock(preview.dueAt, language),
    duration: formatReturnDuration(preview.durationMs),
  });
}
