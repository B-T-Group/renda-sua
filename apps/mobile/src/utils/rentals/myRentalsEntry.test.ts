import {
  bookingDismissVersion,
  claimNextCardImpression,
  consumePendingMyRentals,
  countsForMyRentalsTodo,
  formatMyRentalsBadge,
  formatNextRentalPeriod,
  isNextCardDismissed,
  isNextRentalCandidate,
  listingWallNowMs,
  myRentalsEntrySegment,
  myRentalsTodoCount,
  rememberPendingMyRentals,
  resetNextCardImpressions,
  resolveMyRentalsHeaderTap,
  rowsAfterFetch,
  saveDismissal,
  selectNextRental,
  startsWithinListingWindow,
  type KeyValueStore,
  type TodoBooking,
} from './myRentalsEntry';

const NOW = new Date('2026-11-12T18:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function booking(over: Partial<TodoBooking> & Pick<TodoBooking, 'id' | 'status' | 'start_at'>): TodoBooking {
  return {
    end_at: new Date(Date.parse(over.start_at) + 48 * HOUR).toISOString(),
    updated_at: 'v1',
    ...over,
  };
}

function memoryStore(): KeyValueStore & { dump: Map<string, unknown> } {
  const dump = new Map<string, unknown>();
  return {
    dump,
    async getObject<T>(key: string) {
      return (dump.get(key) as T) ?? null;
    },
    async setObject<T>(key: string, value: T) {
      dump.set(key, value);
    },
    async remove(key: string) {
      dump.delete(key);
    },
  };
}

describe('my rentals badge', () => {
  it('hides 0, shows 3, and caps 12 at 9+', () => {
    expect(formatMyRentalsBadge(0)).toBeNull();
    expect(formatMyRentalsBadge(3)).toBe('3');
    expect(formatMyRentalsBadge(12)).toBe('9+');
  });

  it('counts action items plus Douala bookings inside 48h', () => {
    const soon = new Date(listingWallNowMs(NOW) + 47 * HOUR).toISOString();
    const later = new Date(listingWallNowMs(NOW) + 49 * HOUR).toISOString();
    const requests = [
      { status: 'pending', rental_selection_windows: [{ start_at: soon }] },
      { status: 'available', rental_selection_windows: [{ start_at: later }] },
    ];
    const bookings = [
      booking({ id: 'pay', status: 'proposed', start_at: later }),
      booking({ id: 'soon', status: 'confirmed', start_at: soon }),
      booking({ id: 'later', status: 'confirmed', start_at: later }),
    ];
    expect(myRentalsTodoCount(requests, bookings, NOW)).toBe(3);
    expect(formatMyRentalsBadge(myRentalsTodoCount([], [], NOW))).toBeNull();
    const dozen = Array.from({ length: 12 }, (_, index) =>
      booking({ id: `p${index}`, status: 'proposed', start_at: later })
    );
    expect(formatMyRentalsBadge(myRentalsTodoCount([], dozen, NOW))).toBe('9+');
  });
});

describe('Douala 48h boundary', () => {
  it('uses Africa/Douala wall clock, inclusive at 48h', () => {
    expect(listingWallNowMs(NOW)).toBe(Date.parse('2026-11-12T19:00:00.000Z'));
    const edge = '2026-11-14T19:00:00.000Z';
    const over = '2026-11-14T19:00:00.001Z';
    expect(startsWithinListingWindow(edge, NOW)).toBe(true);
    expect(startsWithinListingWindow(over, NOW)).toBe(false);
    expect(countsForMyRentalsTodo({ bookingStatus: 'confirmed', startAt: edge }, NOW)).toBe(true);
    expect(countsForMyRentalsTodo({ bookingStatus: 'confirmed', startAt: over }, NOW)).toBe(false);
    expect(countsForMyRentalsTodo({ requestStatus: 'pending', startAt: edge }, NOW)).toBe(false);
  });
});

describe('header tap routing', () => {
  it('opens To do when the count is above 0, otherwise Upcoming', () => {
    expect(resolveMyRentalsHeaderTap(true, 2)).toEqual({ action: 'open_hub', segment: 'action_needed' });
    expect(resolveMyRentalsHeaderTap(true, 0)).toEqual({ action: 'open_hub', segment: 'upcoming' });
    expect(myRentalsEntrySegment(3)).toBe('action_needed');
    expect(myRentalsEntrySegment(0)).toBe('upcoming');
  });

  it('sends a signed-out renter to sign in', () => {
    expect(resolveMyRentalsHeaderTap(false, 4)).toEqual({ action: 'sign_in' });
  });
});

describe('next rental card', () => {
  const soon = '2026-11-14T08:00:00.000Z';
  const later = '2026-11-16T08:00:00.000Z';

  it('picks the soonest accepted booking and skips a Requested row', () => {
    expect(isNextRentalCandidate('pending')).toBe(false);
    expect(isNextRentalCandidate('confirmed')).toBe(true);
    const requested = booking({ id: 'req', status: 'pending', start_at: '2026-11-13T08:00:00.000Z' });
    const laterBooking = booking({ id: 'later', status: 'confirmed', start_at: later });
    const sooner = booking({ id: 'soon', status: 'reserved', start_at: soon });
    expect(selectNextRental([laterBooking, requested, sooner], NOW)?.id).toBe('soon');
    expect(selectNextRental([requested], NOW)).toBeNull();
  });

  it('formats the period from the listing calendar', () => {
    const label = (count: number) => (count === 1 ? '1 day' : `${count} days`);
    expect(formatNextRentalPeriod(soon, '2026-11-16T08:00:00.000Z', 'en', label)).toBe('Sat 14 Nov · 2 days');
  });

  it('keeps a dismissal until the booking version changes', async () => {
    const row = booking({ id: 'soon', status: 'confirmed', start_at: soon, updated_at: 'v1' });
    const store = memoryStore();
    const dismissal = { bookingId: row.id, version: bookingDismissVersion(row) };
    await saveDismissal(store, dismissal);
    expect(isNextCardDismissed(row, dismissal)).toBe(true);
    expect(isNextCardDismissed({ ...row, updated_at: 'v2' }, dismissal)).toBe(false);
    expect(isNextCardDismissed(booking({ id: 'other', status: 'confirmed', start_at: later }), dismissal)).toBe(
      false
    );
  });
});

describe('offline cache and pending open', () => {
  it('keeps the cached rows when a refresh fails', () => {
    const cached = { requests: [{ status: 'available' }], bookings: [] };
    expect(rowsAfterFetch(cached, { ok: false })).toEqual(cached);
    expect(myRentalsTodoCount(cached.requests, cached.bookings, NOW)).toBe(1);
    const fresh = { requests: [], bookings: [] };
    expect(rowsAfterFetch(cached, { ok: true, rows: fresh })).toEqual(fresh);
  });

  it('remembers a sign-in continuation until it is consumed', async () => {
    const store = memoryStore();
    await rememberPendingMyRentals(store, 'upcoming', 1_000);
    expect(await consumePendingMyRentals(store, 1_000)).toBe('upcoming');
    expect(await consumePendingMyRentals(store, 2_000)).toBeNull();
  });

  it('emits the card impression once per session', () => {
    resetNextCardImpressions();
    expect(claimNextCardImpression('soon')).toBe(true);
    expect(claimNextCardImpression('soon')).toBe(false);
    expect(claimNextCardImpression('other')).toBe(true);
  });
});
