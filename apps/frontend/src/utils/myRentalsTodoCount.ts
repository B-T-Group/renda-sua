import { resolveRentalPhase } from './rentalPhase';

/** Keep in sync with apps/mobile/src/utils/rentals/myRentalsEntry.ts */
export const LISTING_TIME_ZONE = 'Africa/Douala';
const TODO_WINDOW_MS = 48 * 60 * 60 * 1000;
const ACTION_PHASES = new Set(['offer_ready', 'in_progress']);
const WINDOW_PHASES = new Set(['reserved', 'ready_for_pickup']);

export interface TodoRequest {
  status?: string | null;
  rental_selection_windows?: Array<{ start_at?: string | null }> | null;
  rental_booking?: { id?: string | null; status?: string | null } | null;
}

export interface TodoBooking {
  id: string;
  status: string;
  start_at: string;
}

export function listingWallNowMs(now: Date, timeZone = LISTING_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const wall = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second')
  );
  return wall + now.getMilliseconds();
}

export function countsForMyRentalsTodo(
  input: { requestStatus?: string | null; bookingStatus?: string | null; startAt?: string | null },
  now: Date
): boolean {
  const phase = resolveRentalPhase(
    { requestStatus: input.requestStatus, bookingStatus: input.bookingStatus },
    'client'
  ).phase;
  if (ACTION_PHASES.has(phase)) return true;
  if (!WINDOW_PHASES.has(phase) || !input.startAt) return false;
  const start = Date.parse(input.startAt);
  if (!Number.isFinite(start)) return false;
  const delta = start - listingWallNowMs(now);
  return delta >= 0 && delta <= TODO_WINDOW_MS;
}

function linkedBookingIds(requests: TodoRequest[]): Set<string> {
  const ids = new Set<string>();
  for (const row of requests) {
    const id = row.rental_booking?.id;
    if (id) ids.add(id);
  }
  return ids;
}

export function myRentalsTodoCount(requests: TodoRequest[], bookings: TodoBooking[], now: Date): number {
  let count = 0;
  for (const row of requests) {
    const hit = countsForMyRentalsTodo(
      {
        requestStatus: row.status,
        bookingStatus: row.rental_booking?.status ?? null,
        startAt: row.rental_selection_windows?.[0]?.start_at ?? null,
      },
      now
    );
    if (hit) count += 1;
  }
  const linked = linkedBookingIds(requests);
  for (const row of bookings) {
    if (linked.has(row.id)) continue;
    const hit = countsForMyRentalsTodo({ bookingStatus: row.status, startAt: row.start_at }, now);
    if (hit) count += 1;
  }
  return count;
}

export function formatMyRentalsBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (count > 9) return '9+';
  return String(Math.floor(count));
}

export function myRentalsEntrySegment(count: number): 'action_needed' | 'upcoming' {
  return count > 0 ? 'action_needed' : 'upcoming';
}
