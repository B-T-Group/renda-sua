import { presentRentalSearch } from './assistant-rental-present';
import { cardWindowUnfitReply, formatCardCutoff } from './assistant-rental-card-copy';
import { addCalendarDays } from './assistant-rental-dates';
import type { RentalSearchHit } from '../rentals/rental-search.service';
import { exclusiveEndInstant, latestCardEndAt, latestExclusiveEndDate } from '../rentals/rental-card-window';

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

  it('does not let the owner request their own listing unless self-booking is on', () => {
    const blocked = searchOf({ ownListingIds: ['listing-1'], allowSelfBooking: false });
    expect(blocked.cards[0].rental?.availability).toBe('own_listing');
    expect(blocked.cards[0].rental?.canRequest).toBe(false);
    expect(blocked.cards[0].rental?.cta).toBe('own');
    expect(blocked.cards[0].rental?.quoteTotal).toBeUndefined();
    const allowed = searchOf({ ownListingIds: ['listing-1'], allowSelfBooking: true });
    expect(allowed.cards[0].rental?.availability).toBe('available');
    expect(allowed.cards[0].rental?.canRequest).toBe(true);
    expect(allowed.cards[0].rental?.cta).toBe('request');
    expect(allowed.cards[0].rental?.quoteTotal).toBe(2500);
  });

  it('shifts a booked listing only to a start before the card cutoff', () => {
    const sample = hit();
    const cap = latestExclusiveEndDate(sample.latest_card_end_at as string, 'Africa/Douala');
    const next = addCalendarDays(cap, -2);
    const shifted = searchOf({
      hits: [{ ...sample, available: false, nextAvailableDate: next }],
      startDate: addCalendarDays(cap, -2),
      endDate: addCalendarDays(cap, -1),
      dayCount: 5,
    });
    expect(shifted.cards[0].rental?.cta).toBe('shift');
    expect(shifted.cards[0].rental?.shiftStart).toBe(next);
    expect(shifted.cards[0].rental?.shiftEnd).toBe(cap);
    expect(shifted.cards[0].rental?.quoteTotal).toBeUndefined();
    const closed = searchOf({
      hits: [{ ...sample, available: false, nextAvailableDate: cap }],
      startDate: addCalendarDays(cap, -2),
      endDate: addCalendarDays(cap, -1),
      dayCount: 1,
    });
    expect(closed.cards[0].rental?.cta).toBe('none');
    expect(closed.cards[0].rental?.shiftStart).toBeUndefined();
  });

  it('asks a signed-out renter to sign in and still marks the listing requestable', () => {
    const presented = searchOf({ signedIn: false });
    expect(presented.cards[0].rental?.cta).toBe('sign_in');
    expect(presented.cards[0].rental?.canRequest).toBe(true);
    expect(presented.cards[0].rental?.availability).toBe('available');
  });
});

function searchOf(extra: Record<string, unknown>) {
  return presentRentalSearch({
    hits: [hit()],
    total: 1,
    locale: 'en',
    query: 'hammer',
    units: 1,
    signedIn: true,
    ownListingIds: [],
    allowSelfBooking: false,
    status: 'ok',
    startDate: '2026-11-14',
    endDate: '2026-11-15',
    dayCount: 1,
    ...extra,
  });
}
