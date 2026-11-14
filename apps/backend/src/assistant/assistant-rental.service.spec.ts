import { AssistantRentalService } from './assistant-rental.service';
import { addCalendarDays, marketCalendarDate } from './assistant-rental-dates';
import { latestCardEndAt, latestExclusiveEndDate } from '../rentals/rental-card-window';
import type { AssistantIdentity, AssistantRentalTurn } from './assistant.types';
import type { RentalSearchHit } from '../rentals/rental-search.service';

const ZONE = 'Africa/Douala';

describe('AssistantRentalService edges', () => {
  const search = {
    search: jest.fn(),
    cardWindow: jest.fn(),
    cardGuardEnabled: jest.fn(),
    topCategories: jest.fn(),
  };
  const rentals = { getPublicRentalListingById: jest.fn() };
  const flags = { allowSelfBooking: jest.fn() };
  const appConfig = { getClientFlags: jest.fn() };
  const hasura = { executeQuery: jest.fn() };
  const service = new AssistantRentalService(
    search as never,
    rentals as never,
    flags as never,
    appConfig as never,
    { getInventorySearchSuggestions: jest.fn().mockResolvedValue([]) } as never,
    hasura as never,
    { trackEvent: jest.fn().mockResolvedValue(undefined) } as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    flags.allowSelfBooking.mockResolvedValue(false);
    appConfig.getClientFlags.mockResolvedValue({ assistant_shopping_v1: false });
    search.topCategories.mockResolvedValue([]);
    search.cardGuardEnabled.mockResolvedValue(false);
    search.cardWindow.mockResolvedValue(momoWindow());
    hasura.executeQuery.mockResolvedValue({ rental_booking_windows: [] });
  });

  it('enables rentals only when the flag is exactly true', async () => {
    appConfig.getClientFlags.mockResolvedValue({ assistant_rentals_enabled: true });
    await expect(service.enabled('cm')).resolves.toBe(true);
    appConfig.getClientFlags.mockResolvedValue({});
    await expect(service.enabled('cm')).resolves.toBe(false);
    appConfig.getClientFlags.mockResolvedValue({ assistant_rentals_enabled: false });
    await expect(service.enabled()).resolves.toBe(false);
    appConfig.getClientFlags.mockRejectedValue(new Error('down'));
    await expect(service.enabled('GA')).resolves.toBe(false);
  });

  it('returns unavailable after one 400 and retries a 500 once', async () => {
    const { start, end } = ahead(2, 3);
    search.search.mockRejectedValueOnce(Object.assign(new Error('bad query'), { status: 400 }));
    const rejected = await service.run(searchCall(start, end));
    expect(search.search).toHaveBeenCalledTimes(1);
    expect(JSON.parse(rejected.content).status).toBe('unavailable_error');
    search.search.mockRejectedValue(Object.assign(new Error('down'), { status: 500 }));
    const down = await service.run(searchCall(start, end));
    expect(search.search).toHaveBeenCalledTimes(3);
    expect(JSON.parse(down.content).status).toBe('unavailable_error');
  });

  it('hides the owner card unless self-booking is allowed', async () => {
    const { start, end } = ahead(2, 3);
    search.search.mockResolvedValue({ listings: [hammer('own-biz')], total: 1 });
    const blocked = await service.run(searchCall(start, end, 'own-biz'));
    expect(blocked.cards?.[0].rental?.availability).toBe('own_listing');
    expect(blocked.cards?.[0].rental?.canRequest).toBe(false);
    flags.allowSelfBooking.mockResolvedValue(true);
    const allowed = await service.run(searchCall(start, end, 'own-biz'));
    expect(allowed.cards?.[0].rental?.availability).toBe('available');
    expect(allowed.cards?.[0].rental?.canRequest).toBe(true);
  });

  it('drops a card-window suggestion when nothing in it is free', async () => {
    const now = new Date();
    const latest = latestCardEndAt(now, 72, 6).toISOString();
    const cap = latestExclusiveEndDate(latest, ZONE);
    search.cardGuardEnabled.mockResolvedValue(true);
    search.cardWindow.mockResolvedValue({ ...momoWindow(), payment_rail: 'stripe', momo_available: false, latest_card_end_at: latest });
    search.search.mockResolvedValue({ listings: [hammer('biz', false)], total: 1 });
    const { start } = ahead(1, 1);
    const far = addCalendarDays(start, 8);
    const dropped = await service.run(searchCall(start, far));
    expect(JSON.parse(dropped.content).status).toBe('needs_dates');
    expect(dropped.cards?.[0].href).not.toContain(far);
    search.search.mockResolvedValue({ listings: [hammer('biz', true)], total: 1 });
    const kept = await service.run(searchCall(start, far));
    expect(kept.cards?.[0].href).toContain(`end_date=${cap}`);
    expect(kept.cards?.[0].href).not.toContain(far);
  });

  it('rejects an hourly window that does not move forward', async () => {
    rentals.getPublicRentalListingById.mockResolvedValue(listing());
    const at = '2026-11-20T12:00:00.000Z';
    const result = await service.run(quoteCall({ start_at: at, end_at: at, units: 2 }));
    const body = JSON.parse(result.content);
    expect(body.date_issue).toBe('unparseable');
    expect(body.status).toBe('invalid_dates');
    expect(body.quote_total).toBeUndefined();
  });

  it('prices one unit when the request asks for zero and blocks a zero-unit hold', async () => {
    const { start, end } = ahead(2, 3);
    rentals.getPublicRentalListingById.mockResolvedValue(listing());
    const open = await service.run(quoteCall({ start_date: start, end_date: end, units: 0 }));
    expect(JSON.parse(open.content).quote_total).toBe(2500);
    const negative = await service.run(quoteCall({ start_date: start, end_date: end, units: -3 }));
    expect(JSON.parse(negative.content).quote_total).toBe(2500);
    hasura.executeQuery.mockResolvedValue({
      rental_booking_windows: [{
        start_at: `${start}T00:00:00.000Z`,
        end_at: `${end}T12:00:00.000Z`,
        rental_booking: { units_booked: 0 },
      }],
    });
    const held = await service.run(quoteCall({ start_date: start, end_date: end, units: 1 }));
    const body = JSON.parse(held.content);
    expect(body.rule_violation).toBe('units');
    expect(body.units_free).toBe(0);
    expect(body.quote_total).toBeUndefined();
    hasura.executeQuery.mockResolvedValue({ rental_booking_windows: null });
    const missing = await service.run(quoteCall({ start_date: start, end_date: end, units: 1 }));
    expect(JSON.parse(missing.content).quote_total).toBe(2500);
  });
});

function ahead(startOffset: number, endOffset: number) {
  const today = marketCalendarDate(new Date(), ZONE);
  return { start: addCalendarDays(today, startOffset), end: addCalendarDays(today, endOffset) };
}

function searchCall(start: string, end: string, businessId?: string) {
  return {
    name: 'search_rentals',
    input: { query: 'hammer', start_date: start, end_date: end },
    identity: identity(businessId),
    locale: 'en' as const,
    turn: { userText: 'hammer', channel: 'app' as const, rentalRefs: {} },
  };
}

function quoteCall(input: Record<string, unknown>) {
  const turn: AssistantRentalTurn = { userText: 'hammer', channel: 'app', rentalRefs: { r1: 'listing-1' } };
  return {
    name: 'quote_rental',
    input: { ref: 'r1', ...input },
    identity: identity(),
    locale: 'en' as const,
    turn,
  };
}

function identity(businessId?: string): AssistantIdentity {
  return {
    isVerified: true,
    userId: 'u1',
    firstName: 'Ada',
    preferredLanguage: 'en',
    market: { country_code: 'CM', state: 'Littoral' },
    country: 'CM',
    phoneE164: null,
    accountType: 'client',
    clientId: 'c1',
    businessId: businessId ?? null,
  };
}

function momoWindow() {
  return {
    mode: 'authorize_upfront' as const,
    latest_card_end_at: null,
    payment_rail: 'mobile_money' as const,
    momo_available: true,
    stripe_review_hours: 72,
    timezone: ZONE,
  };
}

function listing() {
  return {
    id: 'listing-1',
    base_price_per_hour: 1000,
    base_price_per_day: 2500,
    min_rental_hours: 1,
    max_rental_hours: null,
    units_available: 1,
    rental_item: { currency: 'XAF', business: { id: 'biz' } },
    business_location: { address: { country: 'CM' } },
  };
}

function hammer(businessId: string, available = true): RentalSearchHit {
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
        rental_category: { id: 'tools', name: 'Tools' },
        rental_item_images: [],
        business: { id: businessId, name: 'Studio K' },
      },
      business_location: {
        id: 'loc',
        name: 'Studio K',
        address: { country: 'CM', city: 'Douala', state: 'Littoral' },
      },
    },
    available,
    nextAvailableDate: null,
    pricePerDay: 2500,
    totalForDates: 2500,
    dayCount: 1,
    latest_card_end_at: null,
    payment_rail: 'mobile_money',
    momo_available: true,
    stripe_review_hours: 72,
    timezone: ZONE,
    mode: 'authorize_upfront',
  };
}
