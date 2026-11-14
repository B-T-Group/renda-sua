import { AssistantRentalService } from './assistant-rental.service';
import type { AssistantIdentity, AssistantRentalTurn } from './assistant.types';
import type { RentalSearchHit } from '../rentals/rental-search.service';

/** Friday 13 Nov 2026, 12:00 in Toronto. */
const NOW = new Date('2026-11-13T17:00:00.000Z');
/** 15 Nov 2026, 22:48 in Toronto. Exclusive end 16 Nov is past this cutoff. */
const LATEST = '2026-11-16T03:48:00.000Z';

describe('assistant date chips past the card cutoff', () => {
  const search = {
    search: jest.fn(),
    cardWindow: jest.fn(),
    cardGuardEnabled: jest.fn(),
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

  beforeEach(() => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'nextTick', 'queueMicrotask', 'setImmediate'],
    });
    jest.clearAllMocks();
    flags.allowSelfBooking.mockResolvedValue(true);
    appConfig.getClientFlags.mockResolvedValue({ assistant_shopping_v1: false, assistant_rentals_enabled: true });
    search.cardGuardEnabled.mockResolvedValue(true);
    search.cardWindow.mockResolvedValue(stripeWindow());
    search.topCategories.mockResolvedValue([]);
    search.search.mockImplementation(async (query: SearchArgs) => pageFor(query.end_date));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps an explicit 14–16 request and offers 14–15 from the stated start', async () => {
    const result = await service.run(call({ start_date: '2026-11-14', end_date: '2026-11-16' }, 'perceuse du 14 au 16'));
    expect(result.rental?.dates).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
    expect(result.rental?.dateIssue).toBe('card_window');
    expect(result.cards?.[0].rental?.availability).toBe('unavailable');
    expect(result.cards?.[0].rental?.endDate).toBe('2026-11-16');
    const suggestion = result.rental?.chips?.find((chip) => chip.id === 'suggested-range');
    expect(suggestion).toMatchObject({
      startDate: '2026-11-14',
      endDate: '2026-11-15',
      action: 'dates',
      label: '14 nov. → 15 nov. · 1 jour',
    });
    expect(result.rental?.chips?.some((chip) => chip.id === 'weekend')).toBe(false);
    const payload = JSON.parse(result.content);
    expect(payload.card_window.asked).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16' });
    expect(payload.card_window.offered).toEqual({ startDate: '2026-11-14', endDate: '2026-11-15', dayCount: 1 });
    expect(payload.card_window.say).toBeNull();
    expect(payload.card_window.suggestion_note).toMatch(/22:00 \(heure de Toronto\)/);
    expect(payload.card_window.suggestion_note).toMatch(/Ces dates conviennent à la place/);
    expect(payload.card_window.suggestion_note).not.toMatch(/22:48/);
    const starts = search.search.mock.calls.map((entry) => entry[0].start_date);
    expect(starts).not.toContain('2026-11-13');
    expect(result.rental?.dates?.endDate).not.toBe('2026-11-15');
  });

  it('moves the start earlier when the stated start is too short for min hours', async () => {
    search.search.mockImplementation(async (query: SearchArgs) => pageFor(query.end_date, 30));
    const result = await service.run(call({ start_date: '2026-11-14', end_date: '2026-11-16' }, 'perceuse du 14 au 16'));
    const suggestion = result.rental?.chips?.find((chip) => chip.id === 'suggested-range');
    expect(suggestion).toMatchObject({
      startDate: '2026-11-13',
      endDate: '2026-11-15',
      label: '13 nov. → 15 nov. · 2 jours',
    });
    expect(result.rental?.dates?.startDate).toBe('2026-11-14');
  });

  it('rejects a start that is past or within the next 2 hours', async () => {
    jest.setSystemTime(new Date('2026-11-14T04:30:00.000Z'));
    search.search.mockImplementation(async (query: SearchArgs) => pageFor(query.end_date, 30));
    const result = await service.run(call({ start_date: '2026-11-14', end_date: '2026-11-16' }, 'perceuse du 14 au 16'));
    expect(result.rental?.dates).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
    expect(result.rental?.chips?.some((chip) => chip.id === 'suggested-range')).toBe(false);
    const starts = search.search.mock.calls.map((entry) => entry[0].start_date);
    expect(starts).not.toContain('2026-11-13');
  });

  it('drops the suggestion chip when that range has no available listing', async () => {
    search.search.mockImplementation(async () => pageFor('2026-11-16'));
    const result = await service.run(call({ start_date: '2026-11-14', end_date: '2026-11-16' }, 'perceuse du 14 au 16'));
    expect(result.rental?.dates).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
    expect(result.rental?.dateIssue).toBe('card_window');
    expect(result.rental?.chips?.some((chip) => chip.id === 'suggested-range')).toBe(false);
    const say = JSON.parse(result.content).card_window.say as string;
    expect(say).toMatch(/^Avec une carte, cette location doit se terminer le /);
    expect(say).not.toMatch(/Voici des dates/);
    expect(JSON.parse(result.content).card_window.offered).toBeNull();
  });

  it('hides this weekend when search returns no available listing and does not remap it', async () => {
    search.cardWindow.mockResolvedValue({ ...stripeWindow(), latest_card_end_at: '2026-11-17T03:48:00.000Z' });
    const result = await service.run(call({ query: 'perceuse' }, 'perceuse'));
    const chips = result.rental?.chips || [];
    expect(chips.map((chip) => chip.id)).toEqual(['today', 'tomorrow', 'calendar']);
    expect(chips.find((chip) => chip.id === 'today')).toMatchObject({ startDate: '2026-11-13', endDate: '2026-11-14' });
    expect(chips.find((chip) => chip.id === 'tomorrow')).toMatchObject({ startDate: '2026-11-14', endDate: '2026-11-15' });
    expect(chips.some((chip) => chip.id === 'weekend' || chip.label === 'Ce week-end')).toBe(false);
    expect(chips.some((chip) => chip.endDate === '2026-11-16')).toBe(false);
    const weekendSearches = search.search.mock.calls.filter((entry) => entry[0].end_date === '2026-11-16');
    expect(weekendSearches.length).toBeGreaterThan(0);
    expect(weekendSearches.every((entry) => entry[0].start_date === '2026-11-14')).toBe(true);
  });

  it('keeps today, tomorrow, and this weekend when the guard is off', async () => {
    search.cardGuardEnabled.mockResolvedValue(false);
    const result = await service.run(call({ query: 'perceuse' }, 'perceuse'));
    expect(result.rental?.chips?.map((chip) => chip.id)).toEqual(['today', 'tomorrow', 'weekend', 'calendar']);
    expect(result.rental?.dateIssue).toBeUndefined();
    const dated = search.search.mock.calls.filter((entry) => entry[0].end_date);
    expect(dated).toHaveLength(0);
  });
});

type SearchArgs = { q?: string; end_date?: string; start_date?: string };

function call(input: Record<string, unknown>, userText: string) {
  const turn: AssistantRentalTurn = { userText, channel: 'app', rentalRefs: {} };
  return {
    name: 'search_rentals',
    input: { query: 'perceuse', ...input },
    identity: identity(),
    locale: 'fr' as const,
    turn,
  };
}

function identity(): AssistantIdentity {
  return {
    isVerified: true,
    userId: 'u1',
    firstName: 'Ada',
    preferredLanguage: 'fr',
    market: { country_code: 'CA' },
    country: 'CA',
    phoneE164: null,
    accountType: 'client',
    clientId: 'c1',
  };
}

function stripeWindow() {
  return {
    mode: 'authorize_upfront' as const,
    latest_card_end_at: LATEST,
    payment_rail: 'stripe' as const,
    momo_available: false,
    stripe_review_hours: 72,
    timezone: 'America/Toronto',
  };
}

function pageFor(end?: string, minHours = 1) {
  const available = end !== '2026-11-16';
  return {
    listings: [drill(available, minHours)],
    total: 1,
    page: 1,
    limit: 6,
    availableCount: available ? 1 : 0,
    dates: end ? { startDate: '2026-11-13', endDate: end, dayCount: 1 } : null,
    ...stripeWindow(),
  };
}

function drill(available: boolean, minHours = 1): RentalSearchHit {
  return {
    listing: {
      id: 'drill-1',
      base_price_per_hour: 10,
      base_price_per_day: 40,
      min_rental_hours: minHours,
      max_rental_hours: null,
      units_available: 1,
      pickup_instructions: '',
      dropoff_instructions: '',
      weekly_availability: [],
      rental_item: {
        id: 'item-drill',
        name: 'Perceuse',
        description: '',
        tags: [],
        currency: 'CAD',
        operation_mode: 'take_home',
        rental_category: { id: 'tools', name: 'Tools' },
        rental_item_images: [],
        business: { id: 'biz', name: 'Atelier' },
      },
      business_location: {
        id: 'loc',
        name: 'Atelier',
        address: { country: 'CA', city: 'Toronto' },
      },
    },
    available,
    nextAvailableDate: null,
    pricePerDay: 40,
    totalForDates: available ? 40 : null,
    dayCount: 1,
    ...stripeWindow(),
  };
}
