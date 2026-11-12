/**
 * Capacity shared by booking (`assertCapacity`) and dated rental search.
 *
 * A hold is the peak of `units_booked` on overlapping `rental_booking_windows`
 * for reserved, confirmed, active, awaiting_return, and proposed bookings whose
 * contract has not expired. `rental_booking_units` are booking-scoped inspection
 * labels (Unit 1, Unit 2). They are allocated to equal `units_booked` and are
 * not a second inventory pool. Counting them would show a listing as free
 * before inspection creates the slots, which booking would then reject.
 */

export const RENTAL_HELD_STATUSES = [
  'reserved',
  'confirmed',
  'active',
  'awaiting_return',
] as const;

export const RENTAL_PROPOSED_STATUS = 'proposed';

export const RENTAL_AVAILABILITY_HORIZON_DAYS = 45;

export interface CapacityWindow {
  startMs: number;
  endMs: number;
  units: number;
}

export interface WeeklyAvailability {
  weekday: number;
  is_available: boolean;
}

/** Peak concurrent units inside [rangeStartMs, rangeEndMs). Ends sort before starts. */
export function peakConcurrentUnits(
  windows: CapacityWindow[],
  rangeStartMs: number,
  rangeEndMs: number
): number {
  const events = capacityEvents(windows, rangeStartMs, rangeEndMs);
  return sweepPeak(events);
}

export function isHeldBooking(
  status: string,
  contractExpiresAt: string | null | undefined,
  nowMs: number
): boolean {
  if ((RENTAL_HELD_STATUSES as readonly string[]).includes(status)) return true;
  if (status !== RENTAL_PROPOSED_STATUS || !contractExpiresAt) return false;
  return new Date(contractExpiresAt).getTime() > nowMs;
}

export function unitsStillFree(
  unitsAvailable: number,
  windows: CapacityWindow[],
  startMs: number,
  endMs: number,
  want = 1
): boolean {
  const cap = Math.max(1, Number(unitsAvailable) || 1);
  const used = peakConcurrentUnits(windows, startMs, endMs);
  return used + want <= cap;
}

/**
 * Date search checks that each UTC weekday in the range is marked open.
 * It does not require midnight-to-midnight to sit inside open hours: those
 * hours are enforced when the request sheet submits a clock time.
 * Missing weekly rows are treated as open so a listing without hours still lists.
 */
export function weekdaysOpen(
  weekly: WeeklyAvailability[] | null | undefined,
  startMs: number,
  endMs: number
): boolean {
  if (!weekly?.length) return true;
  let cursor = startMs;
  while (cursor < endMs) {
    const day = new Date(cursor).getUTCDay();
    const row = weekly.find((w) => w.weekday === day);
    if (row && !row.is_available) return false;
    cursor += 86_400_000;
  }
  return true;
}

export function nextFreeStartMs(input: {
  unitsAvailable: number;
  windows: CapacityWindow[];
  weekly?: WeeklyAvailability[] | null;
  startMs: number;
  endMs: number;
  nowMs: number;
}): number | null {
  const duration = input.endMs - input.startMs;
  if (duration <= 0) return null;
  const day = 86_400_000;
  const origin = Math.max(input.startMs, startOfUtcDay(input.nowMs));
  for (let i = 0; i <= RENTAL_AVAILABILITY_HORIZON_DAYS; i += 1) {
    const start = origin + i * day;
    const end = start + duration;
    if (!weekdaysOpen(input.weekly, start, end)) continue;
    if (unitsStillFree(input.unitsAvailable, input.windows, start, end)) {
      return start;
    }
  }
  return null;
}

function capacityEvents(
  windows: CapacityWindow[],
  rangeStartMs: number,
  rangeEndMs: number
): Array<{ t: number; delta: number }> {
  const events: Array<{ t: number; delta: number }> = [];
  for (const w of windows) {
    const start = Math.max(w.startMs, rangeStartMs);
    const end = Math.min(w.endMs, rangeEndMs);
    if (end <= start) continue;
    events.push({ t: start, delta: w.units });
    events.push({ t: end, delta: -w.units });
  }
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);
  return events;
}

function sweepPeak(events: Array<{ t: number; delta: number }>): number {
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
