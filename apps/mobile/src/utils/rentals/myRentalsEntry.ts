import { formatRequestDay } from './rentalRequestFormat';
import { resolveRentalPhase } from './rentalPhase';

/** Listing wall clock. Booking timestamps are stored as that clock with a Z suffix. */
export const LISTING_TIME_ZONE = 'Africa/Douala';
export const TODO_WINDOW_MS = 48 * 60 * 60 * 1000;
export const MY_RENTALS_ENTRY_CACHE_KEY = '@RendasuaAgent:rentals:entryCache';
export const MY_RENTALS_DISMISS_KEY = '@RendasuaAgent:rentals:nextCardDismissed';
export const MY_RENTALS_PENDING_KEY = '@RendasuaAgent:rentals:pendingEntry';
const PENDING_MAX_MS = 10 * 60 * 1000;

const ACTION_PHASES = new Set(['offer_ready', 'in_progress']);
const WINDOW_PHASES = new Set(['reserved', 'ready_for_pickup']);
const NEXT_STATUSES = new Set(['proposed', 'reserved', 'confirmed', 'active', 'awaiting_return']);

export interface TodoRequest {
  status?: string | null;
  rental_selection_windows?: Array<{ start_at?: string | null }> | null;
  rental_booking?: { id?: string | null; status?: string | null } | null;
}

export interface TodoBooking {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  updated_at?: string | null;
}

export interface NextCardDismissal {
  bookingId: string;
  version: string;
}

export interface EntryCache<B extends TodoBooking = TodoBooking, R extends TodoRequest = TodoRequest> {
  requests: R[];
  bookings: B[];
}

export interface KeyValueStore {
  getObject<T>(key: string): Promise<T | null>;
  setObject<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export type MyRentalsSegment = 'action_needed' | 'upcoming';

type WallPart = Intl.DateTimeFormatPartTypes;

function wallPart(parts: Intl.DateTimeFormatPart[], type: WallPart): number {
  return Number(parts.find((part) => part.type === type)?.value ?? '0');
}

/** "Now" as Africa/Douala wall-clock milliseconds, comparable to stored Z timestamps. */
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
  const hour = wallPart(parts, 'hour') % 24;
  const wall = Date.UTC(
    wallPart(parts, 'year'),
    wallPart(parts, 'month') - 1,
    wallPart(parts, 'day'),
    hour,
    wallPart(parts, 'minute'),
    wallPart(parts, 'second')
  );
  return wall + now.getMilliseconds();
}

export function startsWithinListingWindow(
  startAt: string,
  now: Date,
  windowMs = TODO_WINDOW_MS
): boolean {
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return false;
  const delta = start - listingWallNowMs(now);
  return delta >= 0 && delta <= windowMs;
}

function requestStart(row: TodoRequest): string | null {
  return row.rental_selection_windows?.[0]?.start_at ?? null;
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
  return startsWithinListingWindow(input.startAt, now);
}

function linkedBookingIds(requests: TodoRequest[]): Set<string> {
  const ids = new Set<string>();
  for (const row of requests) {
    const id = row.rental_booking?.id;
    if (id) ids.add(id);
  }
  return ids;
}

function countRequests(requests: TodoRequest[], now: Date): number {
  let count = 0;
  for (const row of requests) {
    const hit = countsForMyRentalsTodo(
      {
        requestStatus: row.status,
        bookingStatus: row.rental_booking?.status ?? null,
        startAt: requestStart(row),
      },
      now
    );
    if (hit) count += 1;
  }
  return count;
}

function countBookings(bookings: TodoBooking[], linked: Set<string>, now: Date): number {
  let count = 0;
  for (const row of bookings) {
    if (linked.has(row.id)) continue;
    const hit = countsForMyRentalsTodo(
      { bookingStatus: row.status, startAt: row.start_at },
      now
    );
    if (hit) count += 1;
  }
  return count;
}

export function myRentalsTodoCount(
  requests: TodoRequest[],
  bookings: TodoBooking[],
  now: Date
): number {
  return countRequests(requests, now) + countBookings(bookings, linkedBookingIds(requests), now);
}

export function formatMyRentalsBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (count > 9) return '9+';
  return String(Math.floor(count));
}

export function myRentalsEntrySegment(count: number): MyRentalsSegment {
  return count > 0 ? 'action_needed' : 'upcoming';
}

export function resolveMyRentalsHeaderTap(
  signedIn: boolean,
  todoCount: number
): { action: 'sign_in' } | { action: 'open_hub'; segment: MyRentalsSegment } {
  if (!signedIn) return { action: 'sign_in' };
  return { action: 'open_hub', segment: myRentalsEntrySegment(todoCount) };
}

function bookingStillOpen(row: TodoBooking, now: Date): boolean {
  if (row.status === 'active' || row.status === 'awaiting_return') return true;
  const end = Date.parse(row.end_at);
  if (!Number.isFinite(end)) return true;
  return end > listingWallNowMs(now);
}

/** Accepted, active, or upcoming bookings. A still-Requested row is not a candidate. */
export function isNextRentalCandidate(status: string): boolean {
  return NEXT_STATUSES.has(status);
}

export function selectNextRental<T extends TodoBooking>(bookings: T[], now: Date): T | null {
  const open = bookings.filter((row) => isNextRentalCandidate(row.status) && bookingStillOpen(row, now));
  open.sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at));
  return open[0] ?? null;
}

export function bookingDismissVersion(
  row: Pick<TodoBooking, 'updated_at' | 'status' | 'start_at' | 'end_at'>
): string {
  const stamp = row.updated_at?.trim();
  if (stamp) return stamp;
  return `${row.status}|${row.start_at}|${row.end_at}`;
}

export function isNextCardDismissed(row: TodoBooking, dismissal: NextCardDismissal | null): boolean {
  if (!dismissal || dismissal.bookingId !== row.id) return false;
  return dismissal.version === bookingDismissVersion(row);
}

export function rentalSpanDays(startAt: string, endAt: string): number {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export function formatNextRentalPeriod(
  startAt: string,
  endAt: string,
  locale: string,
  dayLabel: (count: number) => string
): string {
  const day = formatRequestDay(startAt.slice(0, 10), locale);
  return `${day} · ${dayLabel(rentalSpanDays(startAt, endAt))}`;
}

export function rowsAfterFetch<T>(
  previous: T | null,
  result: { ok: true; rows: T } | { ok: false }
): T | null {
  return result.ok ? result.rows : previous;
}

const impressedBookingIds = new Set<string>();

export function claimNextCardImpression(bookingId: string): boolean {
  if (impressedBookingIds.has(bookingId)) return false;
  impressedBookingIds.add(bookingId);
  return true;
}

export function resetNextCardImpressions(): void {
  impressedBookingIds.clear();
}

export async function loadEntryCache(store: KeyValueStore): Promise<EntryCache | null> {
  return store.getObject<EntryCache>(MY_RENTALS_ENTRY_CACHE_KEY);
}

export async function saveEntryCache(store: KeyValueStore, rows: EntryCache): Promise<void> {
  await store.setObject(MY_RENTALS_ENTRY_CACHE_KEY, rows);
}

export async function loadDismissal(store: KeyValueStore): Promise<NextCardDismissal | null> {
  return store.getObject<NextCardDismissal>(MY_RENTALS_DISMISS_KEY);
}

export async function saveDismissal(store: KeyValueStore, dismissal: NextCardDismissal): Promise<void> {
  await store.setObject(MY_RENTALS_DISMISS_KEY, dismissal);
}

export async function rememberPendingMyRentals(
  store: KeyValueStore,
  segment: MyRentalsSegment,
  now = Date.now()
): Promise<void> {
  await store.setObject(MY_RENTALS_PENDING_KEY, { segment, savedAt: now });
}

export async function consumePendingMyRentals(
  store: KeyValueStore,
  now = Date.now()
): Promise<MyRentalsSegment | null> {
  const saved = await store.getObject<{ segment?: string; savedAt?: number }>(MY_RENTALS_PENDING_KEY);
  await store.remove(MY_RENTALS_PENDING_KEY);
  if (saved?.segment !== 'action_needed' && saved?.segment !== 'upcoming') return null;
  if (typeof saved.savedAt !== 'number' || now - saved.savedAt > PENDING_MAX_MS) return null;
  return saved.segment;
}
