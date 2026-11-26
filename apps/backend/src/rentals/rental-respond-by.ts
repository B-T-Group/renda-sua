import { wallClockToInstantMs } from './wall-clock';

/**
 * Business must answer within 24 hours, or by the rental start if that is sooner.
 * respond_by is a real instant. Request starts are listing wall clock stored as
 * UTC components (Toronto 14:00 is `T14:00:00Z`), so the start cap converts them
 * to the real instant on the listing clock first.
 */
export const RENTAL_RESPOND_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RentalRespondWindow = 'sla' | 'start';

export function computeRespondBy(input: {
  createdAt: string;
  startAt: string | null;
  timeZone: string;
}): { respondBy: string; window: RentalRespondWindow } {
  const created = Date.parse(input.createdAt);
  const sla = (Number.isFinite(created) ? created : Date.now()) + RENTAL_RESPOND_WINDOW_MS;
  const start = startInstantMs(input.startAt, input.timeZone);
  if (Number.isFinite(start) && start < sla) {
    return { respondBy: new Date(start).toISOString(), window: 'start' };
  }
  return { respondBy: new Date(sla).toISOString(), window: 'sla' };
}

/** Stored respond_by wins. An edit resets it; created_at is only the fallback. */
export function effectiveRespondBy(input: {
  createdAt: string;
  respondBy?: string | null;
  startAt: string | null;
  timeZone: string;
}): { respondBy: string; window: RentalRespondWindow } {
  const computed = computeRespondBy({
    createdAt: input.createdAt,
    startAt: input.startAt,
    timeZone: input.timeZone,
  });
  const stored = input.respondBy && Number.isFinite(Date.parse(input.respondBy)) ? input.respondBy : null;
  if (!stored) return computed;
  const atStart = Date.parse(stored) === startInstantMs(input.startAt, input.timeZone);
  return { respondBy: stored, window: atStart ? 'start' : 'sla' };
}

/** Real instant of a wall-clock start; NaN when missing or unparsable. */
export function startInstantMs(startIso: string | null | undefined, timeZone: string): number {
  if (!startIso) return Number.NaN;
  return wallClockToInstantMs(Date.parse(startIso), timeZone);
}

const CONTRACT_HOUR_CAP = 48;

/** Default and maximum contract length: min(48, whole hours until start). Hidden under 1 hour. */
export function contractHoursOffer(startIso: string | null, now: Date, timeZone: string): {
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

function hoursUntil(startIso: string | null, now: Date, timeZone: string): number | null {
  if (!startIso) return null;
  const start = startInstantMs(startIso, timeZone);
  if (!Number.isFinite(start)) return null;
  return (start - now.getTime()) / (60 * 60 * 1000);
}

/** When the start is under an hour away, the contract ends at that start (as a real instant). */
export function cappedContractExpiry(
  startIso: string | null,
  hours: number,
  now: Date,
  timeZone: string
): string | null {
  const offer = contractHoursOffer(startIso, now, timeZone);
  if (offer.hidden) {
    const start = startInstantMs(startIso, timeZone);
    return Number.isFinite(start) ? new Date(start).toISOString() : startIso;
  }
  if (!Number.isInteger(hours) || hours < 1 || hours > offer.maxHours) return null;
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function earliestRequestStartIso(row: {
  requested_start_at?: string | null;
  rental_selection_windows?: unknown;
}): string | null {
  const fromWindows = earliestWindowStart(row.rental_selection_windows);
  if (fromWindows) return fromWindows;
  return row.requested_start_at ?? null;
}

function earliestWindowStart(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  let bestMs = Number.POSITIVE_INFINITY;
  let bestIso: string | null = null;
  for (const item of raw) {
    const start = windowStart(item);
    const ms = start ? Date.parse(start) : Number.NaN;
    if (!Number.isFinite(ms) || ms >= bestMs) continue;
    bestMs = ms;
    bestIso = start;
  }
  return bestIso;
}

function windowStart(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const start = (item as { start_at?: unknown }).start_at;
  return typeof start === 'string' ? start : null;
}

export function compareSoonestRentalStart(
  a: { created_at?: string | null; requested_start_at?: string | null; rental_selection_windows?: unknown },
  b: { created_at?: string | null; requested_start_at?: string | null; rental_selection_windows?: unknown }
): number {
  const startDelta = startMs(a) - startMs(b);
  if (startDelta !== 0) return startDelta;
  return createdMs(a) - createdMs(b);
}

function startMs(row: { requested_start_at?: string | null; rental_selection_windows?: unknown }): number {
  const iso = earliestRequestStartIso(row);
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function createdMs(row: { created_at?: string | null }): number {
  const ms = row.created_at ? Date.parse(row.created_at) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}
