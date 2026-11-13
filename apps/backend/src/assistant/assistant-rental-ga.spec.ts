import { AssistantRentalService } from './assistant-rental.service';
import type { AssistantIdentity, AssistantRentalTurn } from './assistant.types';
import type { RentalSearchHit } from '../rentals/rental-search.service';

const START = '2026-11-17';
const END = '2026-11-18';

describe('assistant rental search in Gabon', () => {
  const search = {
    search: jest.fn(),
    cardWindow: jest.fn(),
    topCategories: jest.fn(),
  };
  const flags = { allowSelfBooking: jest.fn().mockResolvedValue(true) };
  const appConfig = { getClientFlags: jest.fn().mockResolvedValue({ assistant_shopping_v1: false }) };
  const service = new AssistantRentalService(
    search as any,
    {} as any,
    flags as any,
    appConfig as any,
    { getInventorySearchSuggestions: jest.fn().mockResolvedValue([]) } as any,
    { executeQuery: jest.fn().mockResolvedValue({}) } as any,
    { trackEvent: jest.fn().mockResolvedValue(undefined) } as any
  );

  const identity: AssistantIdentity = {
    isVerified: true,
    userId: 'u1',
    firstName: 'Ada',
    preferredLanguage: 'fr',
    market: { country_code: 'GA', state: 'Estuaire' },
    country: 'GA',
    phoneE164: null,
    accountType: 'client',
    clientId: 'c1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    flags.allowSelfBooking.mockResolvedValue(true);
    appConfig.getClientFlags.mockResolvedValue({ assistant_shopping_v1: false });
    search.cardWindow.mockResolvedValue({
      mode: 'authorize_upfront',
      latest_card_end_at: null,
      payment_rail: 'mobile_money',
      momo_available: true,
      stripe_review_hours: 72,
      timezone: 'Africa/Libreville',
    });
    search.topCategories.mockResolvedValue([
      { id: 'vehicles', name: 'Vehicles' },
      { id: 'equipment', name: 'Equipment' },
      { id: 'events', name: 'Events' },
    ]);
  });

  it('attaches the two Tesla cards search returns for 17–18 Nov, not category chips', async () => {
    search.search.mockImplementation(async (query: SearchArgs) => {
      const term = (query.q || '').toLowerCase();
      const sameWindow = query.country_code === 'GA' && query.start_date === START && query.end_date === END;
      if (!sameWindow || query.state || term !== 'tesla') return blank();
      return { listings: [tesla('a'), tesla('b')], total: 2 };
    });
    const result = await service.run(call('car', 'I want a Tesla car in Libreville from 17 Nov to 18 Nov'));
    const rentalCards = (result.cards || []).filter((card) => card.kind === 'rental');
    expect(rentalCards).toHaveLength(2);
    expect(rentalCards.map((card) => card.title)).toEqual(['Tesla Model Y', 'Tesla Model Y']);
    expect(rentalCards.every((card) => card.rental?.availability === 'available')).toBe(true);
    expect(rentalCards.every((card) => card.rental?.minHours === 12)).toBe(true);
    expect(rentalCards[0].href).toContain(`start_date=${START}`);
    expect(rentalCards[0].href).toContain(`end_date=${END}`);
    expect(result.rental?.chips?.some((chip) => chip.action === 'category')).toBeFalsy();
    const matched = search.search.mock.calls.map((entry) => entry[0]).find((query) => query.q === 'tesla' && !query.state);
    expect(matched).toMatchObject({ country_code: 'GA', start_date: START, end_date: END, q: 'tesla' });
    expect(search.search.mock.calls.map((entry) => entry[0].q).join(' ')).not.toMatch(/I want/);
    expect(JSON.parse(result.content).rental_count).toBe(2);
  });

  it('uses the Vehicles category for a car sentence when the title does not contain car', async () => {
    const sentence = 'I want to rent a car in Libreville from 17 Nov to 18 Nov';
    search.search.mockImplementation(async (query: SearchArgs) => {
      const sameWindow = query.country_code === 'GA' && query.start_date === START && query.end_date === END;
      if (!sameWindow || query.state || query.q !== 'Vehicles') return blank();
      return { listings: [tesla('a'), tesla('b')], total: 2 };
    });
    const result = await service.run(call(sentence, sentence));
    expect((result.cards || []).filter((card) => card.kind === 'rental')).toHaveLength(2);
    expect(search.search.mock.calls.map((entry) => entry[0].q)).toContain('Vehicles');
    expect(search.search.mock.calls.map((entry) => entry[0].q)).not.toContain(sentence);
  });

  it('keeps a Cameroon state search that already returns cards', async () => {
    search.search.mockImplementation(async (query: SearchArgs) => {
      if (query.country_code === 'CM' && query.state === 'Littoral' && query.q === 'equipment') {
        return { listings: [tesla('cm')], total: 1 };
      }
      return blank();
    });
    const result = await service.run({
      ...call('equipment', 'rent equipment tomorrow'),
      identity: { ...identity, market: { country_code: 'CM', state: 'Littoral' }, country: 'CM' },
    });
    expect(result.cards).toHaveLength(1);
    expect(search.search).toHaveBeenCalledWith(expect.objectContaining({ country_code: 'CM', state: 'Littoral', q: 'equipment' }));
  });
});

type SearchArgs = { q?: string; country_code?: string; state?: string; start_date?: string; end_date?: string };

function call(query: string, userText: string) {
  const turn: AssistantRentalTurn = { userText, channel: 'app', rentalRefs: {} };
  return {
    name: 'search_rentals',
    input: { query, start_date: START, end_date: END },
    identity: {
      isVerified: true,
      userId: 'u1',
      firstName: 'Ada',
      preferredLanguage: 'fr' as const,
      market: { country_code: 'GA', state: 'Estuaire' },
      country: 'GA',
      phoneE164: null,
      accountType: 'client',
      clientId: 'c1',
    },
    locale: 'fr' as const,
    turn,
  };
}

function blank() {
  return { listings: [], total: 0 };
}

function tesla(id: string): RentalSearchHit {
  return {
    listing: {
      id,
      base_price_per_hour: 20,
      base_price_per_day: 240,
      min_rental_hours: 12,
      max_rental_hours: null,
      units_available: 1,
      pickup_instructions: '',
      dropoff_instructions: '',
      weekly_availability: [],
      rental_item: {
        id: `item-${id}`,
        name: 'Tesla Model Y',
        description: '',
        tags: ['tesla'],
        currency: 'XAF',
        operation_mode: 'take_home',
        rental_category: { id: 'vehicles', name: 'Vehicles' },
        rental_item_images: [],
        business: { id: 'biz', name: 'Centre Ville' },
      },
      business_location: {
        id: 'loc',
        name: 'Centre Ville',
        address: { country: 'GA', state: 'Estuaire Province', city: 'Libreville' },
      },
    },
    available: true,
    nextAvailableDate: null,
    pricePerDay: 240,
    totalForDates: 240,
    dayCount: 1,
    latest_card_end_at: null,
    payment_rail: 'mobile_money',
    momo_available: true,
    stripe_review_hours: 72,
    timezone: 'Africa/Libreville',
    mode: 'authorize_upfront',
  };
}
