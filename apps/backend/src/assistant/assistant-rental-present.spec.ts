import { presentRentalSearch } from './assistant-rental-present';
import type { RentalSearchHit } from '../rentals/rental-search.service';
import { latestCardEndAt } from '../rentals/rental-card-window';

const NOW = new Date('2026-11-13T12:00:00.000Z');

function hit(): RentalSearchHit {
  return {
    listing: {
      id: 'listing-1',
      base_price_per_hour: 1000,
      base_price_per_day: 2500,
      min_rental_hours: 1,
      max_rental_hours: null,
      units_available: 1,
      pickup_instructions: '',
      dropoff_instructions: '',
      weekly_availability: [],
      rental_item: {
        id: 'item-1',
        name: 'Hammer',
        description: '',
        tags: [],
        currency: 'XAF',
        operation_mode: 'take_home',
        rental_category: { id: 'cat', name: 'Tools' },
        rental_item_images: [],
        business: { id: 'biz', name: 'Studio K' },
      },
      business_location: {
        id: 'loc',
        name: 'Studio K',
        address: { country: 'CM', city: 'Douala' },
      },
    },
    available: true,
    nextAvailableDate: null,
    pricePerDay: 2500,
    totalForDates: 2500,
    dayCount: 1,
    latest_card_end_at: latestCardEndAt(NOW).toISOString(),
    payment_rail: 'stripe',
    momo_available: false,
    stripe_review_hours: 72,
    timezone: 'Africa/Douala',
  };
}

describe('rental presenter card window', () => {
  it('prefills the fitting end and tells the model the asked dates do not fit', () => {
    const presented = presentRentalSearch({
      hits: [hit()],
      total: 1,
      locale: 'en',
      query: 'hammer',
      units: 1,
      signedIn: true,
      ownListingIds: [],
      allowSelfBooking: false,
      status: 'ok',
      dateIssue: 'card_window',
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      dayCount: 2,
      cardWindow: {
        fits: false,
        latest_card_end_at: latestCardEndAt(NOW).toISOString(),
        payment_rail: 'stripe',
        momo_available: false,
        stripe_review_hours: 72,
        timezone: 'Africa/Douala',
        asked: { startDate: '2026-11-14', endDate: '2026-11-20' },
        offered: { startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 },
      },
    });
    expect(presented.rental.dates).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
    expect(presented.rental.latest_card_end_at).toEqual(expect.any(String));
    expect(presented.cards[0].href).toContain('end_date=2026-11-16');
    expect(presented.cards[0].href).not.toContain('2026-11-20');
    const payload = JSON.parse(presented.content);
    expect(payload.card_window.fits).toBe(false);
    expect(payload.card_window.offered.endDate).toBe('2026-11-16');
    expect(payload.card_window.payment_rail).toBe('stripe');
  });
});
