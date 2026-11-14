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
