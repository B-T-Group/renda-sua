import { countsForMyRentalsTodo, formatMyRentalsBadge, listingWallNowMs, myRentalsEntrySegment, myRentalsTodoCount } from './myRentalsTodoCount';

const NOW = new Date('2026-11-12T18:00:00.000Z');
const HOUR = 60 * 60 * 1000;

describe('my rentals tab badge', () => {
  it('hides 0, shows the count, and caps at 9+', () => {
    expect(formatMyRentalsBadge(0)).toBeNull();
    expect(formatMyRentalsBadge(2)).toBe('2');
    expect(formatMyRentalsBadge(12)).toBe('9+');
  });

  it('counts pay-now, in progress, and Douala starts inside 48h', () => {
    const soon = new Date(listingWallNowMs(NOW) + 47 * HOUR).toISOString();
    const later = new Date(listingWallNowMs(NOW) + 49 * HOUR).toISOString();
    const requests = [
      { status: 'pending', rental_selection_windows: [{ start_at: soon }] },
      { status: 'available', rental_selection_windows: [{ start_at: later }] },
    ];
    const bookings = [
      { id: 'pay', status: 'proposed', start_at: later },
      { id: 'soon', status: 'confirmed', start_at: soon },
      { id: 'later', status: 'confirmed', start_at: later },
    ];
    expect(myRentalsTodoCount(requests, bookings, NOW)).toBe(3);
    expect(countsForMyRentalsTodo({ requestStatus: 'pending', startAt: soon }, NOW)).toBe(false);
  });

  it('opens To do only when the count is above 0', () => {
    expect(myRentalsEntrySegment(2)).toBe('action_needed');
    expect(myRentalsEntrySegment(0)).toBe('upcoming');
  });
});
