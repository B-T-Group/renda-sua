import { presentRentalSearch } from './assistant-rental-present';
import { cardWindowUnfitReply, formatCardCutoff } from './assistant-rental-card-copy';
import type { RentalSearchHit } from '../rentals/rental-search.service';
import { exclusiveEndInstant, latestCardEndAt } from '../rentals/rental-card-window';

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
        mode: 'authorize_upfront',
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
    expect(payload.card_window.offered.dayCount).toBe(2);
    expect(payload.card_window.payment_rail).toBe('stripe');
    const latest = payload.card_window.latest_card_end_at as string;
    expect(exclusiveEndInstant(payload.card_window.offered.endDate, 'Africa/Douala').getTime()).toBeLessThanOrEqual(Date.parse(latest));
    const say = cardWindowUnfitReply('en', formatCardCutoff(latest, 'Africa/Douala', 'en'));
    expect(payload.card_window.say).toBe(say);
    expect(payload.card_window.say).not.toMatch(/inspected/i);
  });

  it('keeps an asked end past the cutoff on the card and offers the fitting range as a chip', () => {
    const latest = '2026-11-16T03:48:00.000Z';
    const row = hit();
    row.latest_card_end_at = latest;
    row.timezone = 'America/Toronto';
    row.available = false;
    const presented = presentRentalSearch({
      hits: [row],
      total: 1,
      locale: 'fr',
      query: 'drill',
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
        mode: 'authorize_upfront',
        latest_card_end_at: latest,
        payment_rail: 'stripe',
        momo_available: false,
        stripe_review_hours: 72,
        timezone: 'America/Toronto',
        guard: true,
        asked: { startDate: '2026-11-14', endDate: '2026-11-16' },
        offered: { startDate: '2026-11-13', endDate: '2026-11-15', dayCount: 2 },
      },
    });
    expect(presented.rental.dates).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
    expect(presented.rental.dateIssue).toBe('card_window');
    expect(presented.cards[0].rental?.availability).toBe('unavailable');
    expect(presented.cards[0].rental?.startDate).toBe('2026-11-14');
    expect(presented.cards[0].rental?.endDate).toBe('2026-11-16');
    expect(presented.cards[0].href).toContain('end_date=2026-11-16');
    expect(presented.cards[0].href).not.toContain('openRequest=1');
    const suggestion = presented.rental.chips?.find((chip) => chip.id === 'suggested-range');
    expect(suggestion).toMatchObject({ startDate: '2026-11-13', endDate: '2026-11-15', action: 'dates' });
    expect(presented.rental.chips?.some((chip) => chip.id === 'weekend')).toBe(false);
    const payload = JSON.parse(presented.content);
    expect(payload.card_window.fits).toBe(false);
    expect(payload.card_window.say).toMatch(/Avec une carte/);
    expect(payload.date_chips).toEqual([
      expect.objectContaining({ id: 'suggested-range', start_date: '2026-11-13', end_date: '2026-11-15' }),
    ]);
  });
});
