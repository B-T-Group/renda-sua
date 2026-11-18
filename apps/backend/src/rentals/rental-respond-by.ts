/** Business must answer within 24 hours, or by the rental start if that is sooner. */
export const RENTAL_RESPOND_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RentalRespondWindow = 'sla' | 'start';

export function computeRespondBy(input: {
  createdAt: string;
  startAt: string | null;
}): { respondBy: string; window: RentalRespondWindow } {
  const created = Date.parse(input.createdAt);
  const sla = (Number.isFinite(created) ? created : Date.now()) + RENTAL_RESPOND_WINDOW_MS;
  const start = input.startAt ? Date.parse(input.startAt) : Number.NaN;
  if (Number.isFinite(start) && start < sla) {
    return { respondBy: new Date(start).toISOString(), window: 'start' };
  }
  return { respondBy: new Date(sla).toISOString(), window: 'sla' };
}

const CONTRACT_HOUR_CAP = 48;

/** Default and maximum contract length: min(48, whole hours until start). Hidden under 1 hour. */
export function contractHoursOffer(startIso: string | null, now = new Date()): {
  hidden: boolean;
  hours: number;
  maxHours: number;
} {
  const remaining = hoursUntil(startIso, now);
  if (remaining == null) return { hidden: false, hours: CONTRACT_HOUR_CAP, maxHours: CONTRACT_HOUR_CAP };
  if (remaining < 1) return { hidden: true, hours: Math.max(0, remaining), maxHours: 0 };
  const maxHours = Math.min(CONTRACT_HOUR_CAP, Math.floor(remaining));
  return { hidden: false, hours: maxHours, maxHours };
}

function hoursUntil(startIso: string | null, now: Date): number | null {
  if (!startIso) return null;
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return null;
  return (start - now.getTime()) / (60 * 60 * 1000);
}

/** When the start is under an hour away, the contract ends at that start. */
export function cappedContractExpiry(startIso: string | null, hours: number, now = new Date()): string | null {
  const offer = contractHoursOffer(startIso, now);
  if (offer.hidden) return startIso;
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
