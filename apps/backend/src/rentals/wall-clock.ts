import { wallClockNowMs } from './day-hours/day-hours.rules';

const DAY_MS = 86_400_000;

/**
 * Rental start_at / end_at hold the listing's wall clock written as UTC components
 * (Toronto 12:00 is `T12:00:00Z`). These helpers move between that encoding and
 * real instants. Real instants (paid_at, actual_start_at, holds, created_at) never
 * go through them.
 */

/** "Now" read on the listing's wall clock, in the same encoding as start_at. */
export function wallNow(now: Date, timeZone: string): Date {
  if (Number.isNaN(now.getTime())) return now;
  return new Date(wallMsAt(now.getTime(), timeZone));
}

/** wallClockNowMs keeps whole seconds; carry the milliseconds through. */
function wallMsAt(instant: number, timeZone: string): number {
  const ms = ((instant % 1000) + 1000) % 1000;
  return wallClockNowMs(instant - ms, timeZone) + ms;
}

/**
 * The real instant when the listing's clock shows `wallMs`. Matches Postgres
 * `timestamp AT TIME ZONE zone` (rental_wall_to_instant): a repeated autumn time
 * resolves to the second pass (standard time) and a time skipped by spring-forward
 * uses the offset in force before the jump (Toronto 02:30 -> 03:30 EDT).
 */
export function wallClockToInstantMs(wallMs: number, timeZone: string): number {
  if (!Number.isFinite(wallMs)) return Number.NaN;
  const offsetAt = (instant: number) => wallMsAt(instant, timeZone) - instant;
  const before = wallMs - offsetAt(wallMs - DAY_MS);
  const after = wallMs - offsetAt(wallMs + DAY_MS);
  const hits = [before, after].filter((instant) => wallMsAt(instant, timeZone) === wallMs);
  if (hits.length) return Math.max(...hits);
  return before;
}

export function wallClockToInstant(wall: Date, timeZone: string): Date {
  return new Date(wallClockToInstantMs(wall.getTime(), timeZone));
}

/** ISO of the real instant for a stored wall-clock ISO; null when unparsable. */
export function wallIsoToInstantIso(wallIso: string | null | undefined, timeZone: string): string | null {
  if (!wallIso) return null;
  const ms = wallClockToInstantMs(Date.parse(wallIso), timeZone);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Widest gap between a market's wall clock and UTC. Candidate queries that filter
 * wall-clock columns with the real clock widen by this, then each row is rechecked
 * on its own listing clock.
 */
export const WALL_CLOCK_MAX_SKEW_MS = 14 * 3_600_000;
