import { latestExclusiveEndDate } from './rental-card-window';
import { DeclineRankingService } from './decline-ranking/decline-ranking.service';
import { RentalSearchIdCache } from './rental-search-id-cache';
import { RentalSearchService } from './rental-search.service';
import type { PublicRentalListingRow } from './rentals.service';

function listing(id: string, name: string, price = 25000): PublicRentalListingRow {
  return {
    id,
    base_price_per_hour: 1000,
    base_price_per_day: price,
    min_rental_hours: 1,
    max_rental_hours: null,
    units_available: 1,
    pickup_instructions: '',
    dropoff_instructions: '',
    weekly_availability: [],
    rental_item: {
      id: `${id}-item`,
      name,
      description: '',
      tags: [],
      currency: 'XAF',
      operation_mode: 'take_home',
      rental_category: { id: 'cat-cam', name: 'Cameras' },
      rental_item_images: [],
      business: { id: 'biz', name: 'Studio K' },
    },
    business_location: {
      id: 'loc',
      name: 'Studio K',
      address: { country: 'CM', state: 'LT', city: 'Douala' },
    },
  };
}

describe('RentalSearchService', () => {
  const rentals = { collectPublicRentalListings: jest.fn() };
  const hasura = { executeQuery: jest.fn() };
  const service = new RentalSearchService(rentals as any, hasura as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists a free camera before a booked one and totals the free dates', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 10));
    rentals.collectPublicRentalListings.mockResolvedValue([
      listing('booked', 'Nikon Z50'),
      listing('free', 'Canon EOS R50'),
    ]);
    hasura.executeQuery.mockResolvedValue({
      rental_booking_windows: [
        {
          start_at: '2026-11-12T00:00:00.000Z',
          end_at: '2026-11-15T00:00:00.000Z',
          rental_booking: { rental_location_listing_id: 'booked', units_booked: 1 },
        },
      ],
    });
    const result = await service.search({
      q: 'camera',
      start_date: '2026-11-12',
      end_date: '2026-11-15',
      country_code: 'CM',
    });
    expect(result.listings.map((row) => row.listing.id)).toEqual(['free', 'booked']);
    expect(result.listings[0].available).toBe(true);
    expect(result.listings[0].totalForDates).toBe(75000);
    expect(result.listings[0].dayCount).toBe(3);
    expect(result.listings[1].available).toBe(false);
    expect(result.listings[1].nextAvailableDate).toBe('2026-11-15');
    expect(result.listings[1].totalForDates).toBeNull();
    expect(result.availableCount).toBe(1);
    expect(result.payment_rail).toBe('mobile_money');
    expect(result.momo_available).toBe(true);
    expect(result.stripe_review_hours).toBe(72);
    expect(result.timezone).toBe('Africa/Douala');
    expect(result.mode).toBe('authorize_upfront');
    expect(result.latest_card_end_at).toBeNull();
    expect(result.listings[0]).toMatchObject({
      payment_rail: 'mobile_money',
      momo_available: true,
      stripe_review_hours: 72,
      timezone: 'Africa/Douala',
    });
  });

  it('does not mark a card-only Stripe stay available past the cutoff when the guard is on', async () => {
    const routing = { resolveRailForCountry: jest.fn().mockResolvedValue('stripe') };
    const flags = {
      cardWindowGuardEnabled: jest.fn().mockResolvedValue(true),
      chargeAtPickupEnabled: jest.fn().mockResolvedValue(false),
      isEnabled: jest.fn().mockResolvedValue(true),
      numberConfig: jest.fn().mockResolvedValue(72),
    };
    const guarded = new RentalSearchService(rentals as any, hasura as any, routing as any, flags as any);
    const row = listing('ca', 'Drill');
    row.business_location.address.country = 'CA';
    rentals.collectPublicRentalListings.mockResolvedValue([row]);
    hasura.executeQuery.mockResolvedValue({ rental_booking_windows: [] });
    const late = await guarded.search({ start_date: '2026-11-12', end_date: '2026-12-01', country_code: 'CA' });
    const latest = late.listings[0].latest_card_end_at as string;
    const cap = latestExclusiveEndDate(latest, 'America/Toronto');
    expect(late.listings[0].payment_rail).toBe('stripe');
    expect(late.listings[0].momo_available).toBe(false);
    expect(late.listings[0].available).toBe(false);
    const within = await guarded.search({ start_date: '2026-11-13', end_date: cap, country_code: 'CA' });
    expect(within.listings[0].available).toBe(true);
    expect(within.listings[0].latest_card_end_at).toEqual(expect.any(String));
    flags.cardWindowGuardEnabled.mockResolvedValue(false);
    const open = await guarded.search({ start_date: '2026-11-12', end_date: '2026-11-20', country_code: 'CA' });
    expect(open.listings[0].available).toBe(true);
    expect(open.listings[0].latest_card_end_at).toEqual(expect.any(String));
  });

  it('uses the item opt-in for the card window when the flag is on', async () => {
    const routing = { resolveRailForCountry: jest.fn().mockResolvedValue('stripe') };
    const flags = {
      cardWindowGuardEnabled: jest.fn().mockResolvedValue(false),
      chargeAtPickupEnabled: jest.fn().mockResolvedValue(true),
      isEnabled: jest.fn().mockResolvedValue(true),
      optInEnabled: jest.fn().mockResolvedValue(true),
      numberConfig: jest.fn().mockResolvedValue(72),
    };
    const localRentals = {
      collectPublicRentalListings: jest.fn(),
      listingInspectionPolicy: jest.fn().mockResolvedValue(null),
    };
    const localHasura = { executeQuery: jest.fn().mockResolvedValue({ rental_booking_windows: [] }) };
    const searched = new RentalSearchService(localRentals as any, localHasura as any, routing as any, flags as any);
    const row = listing('ca', 'Drill');
    row.business_location.address.country = 'CA';
    localRentals.collectPublicRentalListings.mockResolvedValue([row]);
    const result = await searched.search({ country_code: 'CA' });
    expect(localRentals.listingInspectionPolicy).toHaveBeenCalledWith('CA', 'ca-item');
    expect(result.listings[0].mode).toBe('authorize_upfront');
  });

  it('loads opt-in for the page instead of the whole catalog', async () => {
    const routing = { resolveRailForCountry: jest.fn().mockResolvedValue('mobile_money') };
    const flags = {
      cardWindowGuardEnabled: jest.fn().mockResolvedValue(false),
      chargeAtPickupEnabled: jest.fn().mockResolvedValue(false),
      isEnabled: jest.fn().mockResolvedValue(false),
      optInEnabled: jest.fn().mockResolvedValue(false),
      numberConfig: jest.fn().mockResolvedValue(72),
    };
    const listingWindowByItem = jest.fn(async () => new Map());
    const localRentals = {
      collectPublicRentalListings: jest.fn(),
      listingWindowByItem,
    };
    const searched = new RentalSearchService(localRentals as any, { executeQuery: jest.fn() } as any, routing as any, flags as any);
    const catalog = Array.from({ length: 50 }, (_, index) => {
      const row = listing(`row-${index}`, `Item ${index}`);
      row.business_location.address.country = 'Cameroon';
      return row;
    });
    localRentals.collectPublicRentalListings.mockResolvedValue(catalog);
    await searched.search({ country_code: 'CM', limit: 20 });
    expect(listingWindowByItem).toHaveBeenCalledTimes(1);
    expect(listingWindowByItem.mock.calls[0][0]).toHaveLength(20);
    expect(listingWindowByItem.mock.calls[0][0][0].country).toBe('Cameroon');
    expect(flags.optInEnabled).not.toHaveBeenCalled();
  });

  it('suggests categories and in-market titles', async () => {
    hasura.executeQuery.mockResolvedValue({
      rental_categories: [{ id: 'cat-cam', name: 'Cameras' }],
      rental_items: [
        {
          id: 'item',
          name: 'Canon camera',
          rental_category: { id: 'cat-cam', name: 'Cameras' },
          rental_location_listings: [{ id: 'free', business_location: { address: { country: 'CM', state: 'LT' } } }],
        },
        {
          id: 'other',
          name: 'Canon camera GA',
          rental_category: { id: 'cat-cam', name: 'Cameras' },
          rental_location_listings: [{ id: 'ga', business_location: { address: { country: 'GA', state: '' } } }],
        },
      ],
    });
    const rows = await service.suggest({ q: 'cam', country_code: 'CM' });
    expect(rows).toEqual([
      { kind: 'category', id: 'cat-cam', label: 'Cameras', subtitle: null },
      { kind: 'listing', id: 'free', label: 'Canon camera', subtitle: 'Cameras' },
    ]);
  });

  it('ranks categories by bookings ahead of listing count', async () => {
    rentals.collectPublicRentalListings.mockResolvedValue([
      listing('a', 'Body'),
      listing('b', 'Kit'),
    ]);
    hasura.executeQuery.mockResolvedValue({
      rental_bookings: [
        { rental_location_listing: { rental_item: { rental_category: { id: 'cat-sound', name: 'Sound' } } } },
      ],
    });
    const rows = await service.topCategories({ country_code: 'CM', limit: 6 });
    expect(rows[0]).toMatchObject({ id: 'cat-sound', bookingCount: 1, listingCount: 0 });
    expect(rows[1]).toMatchObject({ id: 'cat-cam', bookingCount: 0, listingCount: 2 });
  });

  it('keeps available listings in catalog order, then the earliest next date', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 10));
    const later = listing('later', 'Later kit');
    const never = listing('never', 'Never kit');
    never.weekly_availability = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      is_available: false,
      start_time: null,
      end_time: null,
    }));
    rentals.collectPublicRentalListings.mockResolvedValue([
      later,
      never,
      listing('free-b', 'Free B'),
      listing('free-a', 'Free A'),
    ]);
    hasura.executeQuery.mockResolvedValue({
      rental_booking_windows: [
        {
          start_at: '2026-11-12T00:00:00.000Z',
          end_at: '2026-11-20T00:00:00.000Z',
          rental_booking: { rental_location_listing_id: 'later', units_booked: 1 },
        },
      ],
    });
    const result = await service.search({
      start_date: '2026-11-12',
      end_date: '2026-11-15',
    });
    expect(result.listings.map((row) => row.listing.id)).toEqual([
      'free-b',
      'free-a',
      'later',
      'never',
    ]);
    expect(result.listings[2].nextAvailableDate).toBe('2026-11-20');
    expect(result.listings[3].nextAvailableDate).toBeNull();
    expect(result.availableCount).toBe(2);
    jest.restoreAllMocks();
  });

  it('drops wildcard characters and does not query a term shorter than two characters', async () => {
    await expect(service.suggest({ q: ' %_ ' })).resolves.toEqual([]);
    await expect(service.suggest({ q: 'a_' })).resolves.toEqual([]);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
    hasura.executeQuery.mockResolvedValue({ rental_categories: [], rental_items: [] });
    await service.suggest({ q: ' Ca%m_era\\ ' });
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pat: '%camera%' })
    );
  });

  it('ranks a title that starts with the term ahead of one that only contains it', async () => {
    hasura.executeQuery.mockResolvedValue({
      rental_categories: [],
      rental_items: [
        {
          id: 'contains',
          name: 'A zoom lens',
          rental_category: { id: 'cat-cam', name: 'Cameras' },
          rental_location_listings: [
            { id: 'contains-listing', business_location: { address: { country: 'CM', state: 'LT' } } },
          ],
        },
        {
          id: 'prefix',
          name: 'Zoom body',
          rental_category: { id: 'cat-cam', name: 'Cameras' },
          rental_location_listings: [
            { id: 'prefix-listing', business_location: { address: { country: 'cm', state: 'lt' } } },
          ],
        },
        {
          id: 'other-state',
          name: 'Zoom CE',
          rental_category: { id: 'cat-cam', name: 'Cameras' },
          rental_location_listings: [
            { id: 'ce-listing', business_location: { address: { country: 'CM', state: 'CE' } } },
          ],
        },
      ],
    });
    const rows = await service.suggest({ q: 'zoom', country_code: 'cm', state: 'lt' });
    expect(rows.map((row) => row.id)).toEqual(['prefix-listing', 'contains-listing']);
  });

  it('pages the full catalog and rejects an impossible date before querying', async () => {
    rentals.collectPublicRentalListings.mockResolvedValue([
      listing('a', 'A'),
      listing('b', 'B'),
      listing('c', 'C'),
    ]);
    const page = await service.search({ page: 2, limit: 1 });
    expect(page.listings.map((row) => row.listing.id)).toEqual(['b']);
    expect(page.total).toBe(3);
    expect(page.availableCount).toBe(0);
    expect(page.dates).toBeNull();
    expect(page.page).toBe(2);
    expect(page.limit).toBe(1);
    const clamped = await service.search({ page: 0, limit: 0 });
    expect(clamped.page).toBe(1);
    expect(clamped.limit).toBe(20);
    await expect(
      service.search({ start_date: '2026-02-31', end_date: '2026-03-02' })
    ).rejects.toMatchObject({ status: 400 });
    expect(rentals.collectPublicRentalListings).toHaveBeenCalledTimes(2);
  });

  it('treats a zero booked-unit window as one unit and ignores a window with no listing', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 10));
    rentals.collectPublicRentalListings.mockResolvedValue([
      listing('open', 'Open'),
      listing('zero', 'Zero'),
    ]);
    hasura.executeQuery.mockResolvedValue({
      rental_booking_windows: [
        { start_at: '2026-11-12T00:00:00.000Z', end_at: '2026-11-15T00:00:00.000Z', rental_booking: null },
        {
          start_at: '2026-11-12T00:00:00.000Z',
          end_at: '2026-11-15T00:00:00.000Z',
          rental_booking: { rental_location_listing_id: 'zero', units_booked: 0 },
        },
      ],
    });
    const result = await service.search({ start_date: '2026-11-12', end_date: '2026-11-15' });
    expect(result.listings.find((row) => row.listing.id === 'open')?.available).toBe(true);
    expect(result.listings.find((row) => row.listing.id === 'zero')?.available).toBe(false);
    rentals.collectPublicRentalListings.mockResolvedValue([]);
    hasura.executeQuery.mockClear();
    await service.search({ start_date: '2026-11-12', end_date: '2026-11-15' });
    expect(hasura.executeQuery).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('caps top categories at 12, breaks a tie by name, and skips a blank category', async () => {
    const rows = Array.from({ length: 13 }, (_, index) => {
      const row = listing(`l${index}`, `Item ${index}`);
      row.rental_item.rental_category = {
        id: `cat-${index}`,
        name: `Cat ${String(index).padStart(2, '0')}`,
      };
      return row;
    });
    const audio = listing('audio', 'Audio kit');
    audio.rental_item.rental_category = { id: 'cat-audio', name: 'Audio' };
    const zoom = listing('zoom', 'Zoom kit');
    zoom.rental_item.rental_category = { id: 'cat-zoom', name: 'Zoom' };
    const blank = listing('blank', 'Blank');
    blank.rental_item.rental_category = { id: '', name: 'Nope' };
    rentals.collectPublicRentalListings.mockResolvedValue([audio, zoom, blank]);
    hasura.executeQuery.mockResolvedValue({
      rental_bookings: [
        { rental_location_listing: null },
        { rental_location_listing: { rental_item: { rental_category: null } } },
      ],
    });
    const tied = await service.topCategories({ limit: 6 });
    expect(tied.map((row) => row.name)).toEqual(['Audio', 'Zoom']);
    rentals.collectPublicRentalListings.mockResolvedValue(rows);
    hasura.executeQuery.mockResolvedValue({ rental_bookings: [] });
    const capped = await service.topCategories({ limit: 100 });
    expect(capped).toHaveLength(12);
    await service.topCategories({ country_code: ' CM ', state: ' LT ' });
    const where = hasura.executeQuery.mock.calls.at(-1)?.[1].where;
    expect(where).toMatchObject({
      status: { _nin: ['cancelled'] },
      rental_location_listing: {
        business_location: { address: { country: { _eq: 'CM' }, state: { _eq: 'LT' } } },
      },
    });
    await service.topCategories({});
    expect(hasura.executeQuery.mock.calls.at(-1)?.[1].where.rental_location_listing).toBeUndefined();
  });

  it('sorts a 0.70 penalty later once the catalog is long enough, and weight 1.0 does not', async () => {
    const first = listing('a', 'First');
    first.rental_item.business = { id: 'clean', name: 'A' };
    const second = listing('b', 'Second');
    second.rental_item.business = { id: 'clean', name: 'B' };
    const penalized = listing('c', 'Penalized');
    penalized.rental_item.business = { id: 'penalized', name: 'C' };
    const fourth = listing('d', 'Fourth');
    fourth.rental_item.business = { id: 'clean', name: 'D' };
    rentals.collectPublicRentalListings.mockResolvedValue([first, second, penalized, fourth]);
    const ranking = { multipliersFor: jest.fn().mockResolvedValue(new Map([['penalized', 0.7]])) };
    const ranked = new RentalSearchService(
      rentals as never,
      hasura as never,
      undefined,
      undefined,
      ranking as unknown as DeclineRankingService
    );
    const moved = await ranked.search({ country_code: 'CM' });
    expect(moved.listings.map((row) => row.listing.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(moved.total).toBe(4);
    expect(ranking.multipliersFor).toHaveBeenCalledWith(['clean', 'clean', 'penalized', 'clean'], 'CM');
    ranking.multipliersFor.mockResolvedValue(new Map([['penalized', 1]]));
    const steady = await ranked.search({ country_code: 'CM' });
    expect(steady.listings.map((row) => row.listing.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('recommended keeps every listing: available, then decline rank, then newest', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 10));
    const penalized = listing('penalized', 'Penalized', 10);
    penalized.rental_item.business = { id: 'penalized', name: 'P' };
    const clean = listing('clean', 'Clean', 20);
    clean.rental_item.business = { id: 'clean', name: 'C' };
    const booked = listing('booked', 'Booked', 30);
    booked.rental_item.business = { id: 'booked-biz', name: 'B' };
    rentals.collectPublicRentalListings.mockResolvedValue([penalized, clean, booked]);
    hasura.executeQuery.mockResolvedValue({
      rental_booking_windows: [
        {
          start_at: '2026-11-12T00:00:00.000Z',
          end_at: '2026-11-15T00:00:00.000Z',
          rental_booking: { rental_location_listing_id: 'booked', units_booked: 1 },
        },
      ],
    });
    const ranking = { multipliersFor: jest.fn().mockResolvedValue(new Map([['penalized', 0.4]])) };
    const ranked = new RentalSearchService(
      rentals as never,
      hasura as never,
      undefined,
      undefined,
      ranking as unknown as DeclineRankingService
    );
    const query = { country_code: 'CM', sort: 'recommended', start_date: '2026-11-12', end_date: '2026-11-15' };
    const moved = await ranked.search(query);
    expect(rentals.collectPublicRentalListings).toHaveBeenCalledWith(expect.objectContaining({ sort: 'newest' }));
    expect(moved.listings.map((row) => row.listing.id)).toEqual(['clean', 'penalized', 'booked']);
    expect(moved.total).toBe(3);
    ranking.multipliersFor.mockResolvedValue(new Map());
    const steady = await ranked.search(query);
    expect(steady.listings.map((row) => row.listing.id)).toEqual(['penalized', 'clean', 'booked']);
    expect(steady.total).toBe(3);
    await ranked.search({ country_code: 'CM', sort: 'relevance' });
    expect(rentals.collectPublicRentalListings).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'relevance' })
    );
    jest.restoreAllMocks();
  });

  it('treats a bad ranking multiplier as neutral and survives a ranking throw', async () => {
    const first = listing('a', 'First');
    first.rental_item.business = { id: 'boosted', name: 'A' };
    const second = listing('b', 'Second');
    second.rental_item.business = { id: 'plain', name: 'B' };
    rentals.collectPublicRentalListings.mockResolvedValue([first, second]);
    const ranking = { multipliersFor: jest.fn().mockResolvedValue(new Map([['boosted', Number.POSITIVE_INFINITY]])) };
    const ranked = new RentalSearchService(
      rentals as never,
      hasura as never,
      undefined,
      undefined,
      ranking as unknown as DeclineRankingService
    );
    const infinite = await ranked.search({ country_code: 'CM' });
    expect(infinite.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
    ranking.multipliersFor.mockResolvedValue(
      new Map<string, number>([
        ['boosted', Number.NaN],
        ['plain', null as unknown as number],
      ])
    );
    const blank = await ranked.search({ country_code: 'CM' });
    expect(blank.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
    ranking.multipliersFor.mockResolvedValue(new Map([['boosted', 2]]));
    const capped = await ranked.search({ country_code: 'CM' });
    expect(capped.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
    ranking.multipliersFor.mockResolvedValue(new Map([['boosted', 0]]));
    const grounded = await ranked.search({ country_code: 'CM' });
    expect(grounded.listings.map((row) => row.listing.id)).toEqual(['b', 'a']);
    ranking.multipliersFor.mockRejectedValue(new Error('ranking down'));
    const fallen = await ranked.search({ country_code: 'CM' });
    expect(fallen.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
    expect(fallen.total).toBe(2);
  });

  it('keeps inspection_enabled from the item opt-in on search hits', async () => {
    const rows = [listing('a', 'A'), listing('b', 'B')];
    const withWindows = {
      collectPublicRentalListings: jest.fn().mockResolvedValue(rows),
      listingWindowByItem: jest.fn().mockResolvedValue(
        new Map<string, boolean | undefined>([
          ['a-item', true],
          ['b-item', false],
        ])
      ),
    };
    const svc = new RentalSearchService(withWindows as never, hasura as never);
    const result = await svc.search({ country_code: 'CM' });
    const byId = (id: string) => result.listings.find((row) => row.listing.id === id);
    expect(byId('a')?.inspection_enabled).toBe(true);
    expect(byId('b')?.inspection_enabled).toBe(false);
    expect(result.total).toBe(2);
  });

  it('keeps one ordered id list across pages, then drops it when the cache expires', async () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => listing(id, id));
    const loadByIds = jest.fn(async (ids: string[]) => ids.map((id) => listing(id, id)).reverse());
    const catalog = {
      collectPublicRentalListings: jest.fn().mockResolvedValue(rows),
      loadPublicRentalListingsByIds: loadByIds,
    };
    const windowCalls: string[][] = [];
    hasura.executeQuery.mockImplementation(async (_query: string, vars: { ids?: string[] }) => {
      if (vars?.ids) windowCalls.push([...vars.ids]);
      return { rental_booking_windows: [] };
    });
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 10));
    try {
      let now = 5_000;
      const cache = new RentalSearchIdCache(4, 1_000, () => now);
      const cached = new RentalSearchService(catalog as never, hasura as never);
      cached.replaceIdCache(cache);
      const query = {
        country_code: 'CM',
        sort: 'newest' as const,
        start_date: '2026-11-22',
        end_date: '2026-11-25',
        limit: 2,
      };
      const first = await cached.search({ ...query, page: 1 });
      const second = await cached.search({ ...query, page: 2 });
      const third = await cached.search({ ...query, page: 3 });
      expect(first.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
      expect(second.listings.map((row) => row.listing.id)).toEqual(['c', 'd']);
      expect(third.listings.map((row) => row.listing.id)).toEqual(['e']);
      const seen = [...first.listings, ...second.listings, ...third.listings].map((row) => row.listing.id);
      expect(seen).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(second.total).toBe(5);
      expect(second.availableCount).toBe(5);
      expect(catalog.collectPublicRentalListings).toHaveBeenCalledTimes(1);
      expect(loadByIds).toHaveBeenNthCalledWith(1, ['c', 'd']);
      expect(loadByIds).toHaveBeenNthCalledWith(2, ['e']);
      expect(windowCalls[0]).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(windowCalls[1]).toEqual(['c', 'd']);
      expect(windowCalls[2]).toEqual(['e']);
      now += 1_000;
      await cached.search({ ...query, page: 1 });
      expect(catalog.collectPublicRentalListings).toHaveBeenCalledTimes(2);
    } finally {
      hasura.executeQuery.mockReset();
      jest.restoreAllMocks();
    }
  });

  it('does not reuse an order when the ranking flag changes, and flag off keeps catalog order', async () => {
    const rows = [listing('a', 'A'), listing('b', 'B')];
    const catalog = {
      collectPublicRentalListings: jest.fn().mockResolvedValue(rows),
      loadPublicRentalListingsByIds: jest.fn(async (ids: string[]) => ids.map((id) => listing(id, id))),
    };
    const flags = {
      declineRankingEnabled: jest.fn().mockResolvedValue(false),
      cardWindowGuardEnabled: jest.fn().mockResolvedValue(false),
      chargeAtPickupEnabled: jest.fn().mockResolvedValue(false),
      isEnabled: jest.fn().mockResolvedValue(false),
      numberConfig: jest.fn().mockResolvedValue(72),
    };
    const cached = new RentalSearchService(catalog as never, hasura as never, undefined, flags as never);
    const first = await cached.search({ country_code: 'CM', sort: 'newest' });
    expect(first.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
    await cached.search({ country_code: 'CM', sort: 'newest', page: 2 });
    expect(catalog.collectPublicRentalListings).toHaveBeenCalledTimes(1);
    flags.declineRankingEnabled.mockResolvedValue(true);
    await cached.search({ country_code: 'CM', sort: 'newest' });
    expect(catalog.collectPublicRentalListings).toHaveBeenCalledTimes(2);
  });

  it('treats cm and CM as one market and does not keep an empty list', async () => {
    const catalog = {
      collectPublicRentalListings: jest.fn(async (query: { country_code?: string }) =>
        query.country_code === 'CM' ? [listing('a', 'A')] : []
      ),
      loadPublicRentalListingsByIds: jest.fn(async (ids: string[]) => ids.map((id) => listing(id, id))),
    };
    const cached = new RentalSearchService(catalog as never, hasura as never);
    const lower = await cached.search({ country_code: 'cm' });
    const upper = await cached.search({ country_code: 'CM' });
    expect(lower.listings.map((row) => row.listing.id)).toEqual(['a']);
    expect(upper.listings.map((row) => row.listing.id)).toEqual(['a']);
    expect(catalog.collectPublicRentalListings).toHaveBeenCalledTimes(1);
    expect(catalog.collectPublicRentalListings).toHaveBeenCalledWith(expect.objectContaining({ country_code: 'CM' }));
    catalog.collectPublicRentalListings.mockResolvedValueOnce([]);
    await cached.search({ country_code: 'GA' });
    catalog.collectPublicRentalListings.mockResolvedValueOnce([listing('g', 'G')]);
    const recovered = await cached.search({ country_code: 'GA' });
    expect(recovered.listings.map((row) => row.listing.id)).toEqual(['g']);
  });

  it('does not let a profile market and an anonymous visitor share an entry', async () => {
    const resolveSearchMarket = jest
      .fn()
      .mockResolvedValueOnce({ filterMode: 'supported_only', degraded: false })
      .mockResolvedValueOnce({ country: 'CM', filterMode: 'specific', degraded: false })
      .mockResolvedValueOnce({ filterMode: 'supported_only', degraded: false });
    const catalog = {
      resolveSearchMarket,
      collectPublicRentalListings: jest.fn(async (query: { country_code?: string }) =>
        query.country_code ? [listing('cm-only', 'CM')] : [listing('all', 'All')]
      ),
      loadPublicRentalListingsByIds: jest.fn(async (ids: string[]) => ids.map((id) => listing(id, id))),
    };
    const cached = new RentalSearchService(catalog as never, hasura as never);
    const anonymous = await cached.search({});
    const profile = await cached.search({});
    const anonymousAgain = await cached.search({});
    expect(anonymous.listings.map((row) => row.listing.id)).toEqual(['all']);
    expect(profile.listings.map((row) => row.listing.id)).toEqual(['cm-only']);
    expect(anonymousAgain.listings.map((row) => row.listing.id)).toEqual(['all']);
    expect(catalog.collectPublicRentalListings).toHaveBeenCalledTimes(2);
  });

  it('uses the stored state spelling for the query and the next cache hit', async () => {
    const resolveSearchMarket = jest.fn(async () => ({
      country: 'CM',
      state: 'Centre Region Province',
      filterMode: 'specific' as const,
      degraded: false,
    }));
    const row = listing('a', 'A');
    row.business_location.address.state = 'Centre Region Province';
    const catalog = {
      resolveSearchMarket,
      collectPublicRentalListings: jest.fn().mockResolvedValue([row]),
      loadPublicRentalListingsByIds: jest.fn(async () => [row]),
    };
    const cached = new RentalSearchService(catalog as never, hasura as never);
    await cached.search({ country_code: 'cm', state: 'centre region province' });
    await cached.search({ country_code: 'CM', state: 'Centre Region Province' });
    expect(catalog.collectPublicRentalListings).toHaveBeenCalledTimes(1);
    expect(catalog.collectPublicRentalListings).toHaveBeenCalledWith(
      expect.objectContaining({ country_code: 'CM', state: 'Centre Region Province' })
    );
  });

  it('does not cache a ranking failure or a degraded market', async () => {
    const rows = [listing('a', 'A'), listing('b', 'B')];
    rows[0].rental_item.business = { id: 'boosted', name: 'A' };
    const collect = jest.fn().mockResolvedValue(rows);
    const catalog = {
      collectPublicRentalListings: collect,
      loadPublicRentalListingsByIds: jest.fn(async (ids: string[]) => ids.map((id) => listing(id, id))),
      resolveSearchMarket: jest.fn().mockResolvedValue({ country: 'CM', filterMode: 'specific', degraded: false }),
    };
    const ranking = {
      multipliersFor: jest
        .fn()
        .mockRejectedValueOnce(new Error('snapshot'))
        .mockResolvedValueOnce(new Map([['boosted', 0]])),
    };
    const cached = new RentalSearchService(
      catalog as never,
      hasura as never,
      undefined,
      undefined,
      ranking as unknown as DeclineRankingService
    );
    const fallen = await cached.search({ country_code: 'CM' });
    expect(fallen.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
    const ranked = await cached.search({ country_code: 'CM' });
    expect(ranked.listings.map((row) => row.listing.id)).toEqual(['b', 'a']);
    expect(ranking.multipliersFor).toHaveBeenCalledTimes(2);
    catalog.resolveSearchMarket.mockResolvedValue({ country: 'CM', filterMode: 'specific', degraded: true });
    await cached.search({ country_code: 'CM' });
    await cached.search({ country_code: 'CM' });
    expect(collect).toHaveBeenCalledTimes(4);
  });

  it('shares one cold computation and stops a warm page that no longer matches', async () => {
    let release: (rows: PublicRentalListingRow[]) => void = () => undefined;
    const collect = jest.fn(
      () =>
        new Promise<PublicRentalListingRow[]>((resolve) => {
          release = resolve;
        })
    );
    const loadByIds = jest.fn(async (ids: string[]) =>
      ids
        .filter((id) => id !== 'c')
        .map((id) => {
          const row = listing(id, id);
          if (id === 'b') {
            row.base_price_per_hour = 9000;
            row.business_location.address.country = 'GA';
          }
          return row;
        })
    );
    const catalog = { collectPublicRentalListings: collect, loadPublicRentalListingsByIds: loadByIds };
    const cached = new RentalSearchService(catalog as never, hasura as never);
    const query = { country_code: 'CM', max_price: 2000, limit: 1 };
    const rows = [listing('a', 'A'), listing('b', 'B'), listing('c', 'C')];
    const first = cached.search({ ...query, page: 1 });
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    const second = cached.search({ ...query, page: 2 });
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    expect(collect).toHaveBeenCalledTimes(1);
    release(rows);
    const [page1, page2] = await Promise.all([first, second]);
    expect(page1.listings.map((row) => row.listing.id)).toEqual(['a']);
    expect(page1.hasMore).toBe(true);
    expect(page2.listings.map((row) => row.listing.id)).toEqual(['b']);
    expect(page2.hasMore).toBe(true);
    const warmPromise = cached.search({ ...query, page: 2 });
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    expect(collect).toHaveBeenCalledTimes(2);
    release(rows);
    const warm = await warmPromise;
    expect(warm.listings.map((row) => row.listing.id)).toEqual(['b']);
    expect(warm.hasMore).toBe(true);
    await cached.search({ ...query, page: 1 });
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('does not emit an unhandledRejection when a cold search fails for several waiters', async () => {
    let rejectCollect: (error: Error) => void = () => undefined;
    const collect = jest.fn(
      () =>
        new Promise<PublicRentalListingRow[]>((_, reject) => {
          rejectCollect = reject;
        })
    );
    const catalog = {
      collectPublicRentalListings: collect,
      loadPublicRentalListingsByIds: jest.fn(async (ids: string[]) => ids.map((id) => listing(id, id))),
    };
    const cached = new RentalSearchService(catalog as never, hasura as never);
    const settle = (pending: Promise<unknown>) =>
      pending.then(
        (value) => ({ ok: true as const, value }),
        (reason: unknown) => ({ ok: false as const, reason })
      );
    const unhandled = await captureUnhandledRejections(async () => {
      const first = settle(cached.search({ country_code: 'CM' }));
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
      const rest = [settle(cached.search({ country_code: 'CM' })), settle(cached.search({ country_code: 'CM' }))];
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
      expect(collect).toHaveBeenCalledTimes(1);
      rejectCollect(new Error('hasura down'));
      const settled = await Promise.all([first, ...rest]);
      expect(settled.map((row) => row.ok)).toEqual([false, false, false]);
    });
    expect(unhandled).toEqual([]);
    collect.mockResolvedValueOnce([listing('a', 'A')]);
    const recovered = await cached.search({ country_code: 'CM' });
    expect(recovered.listings.map((row) => row.listing.id)).toEqual(['a']);
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('recomputes a warm page whose rows were hidden so later pages stay reachable', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const hidden = new Set<string>();
    const collect = jest.fn(async () => ids.filter((id) => !hidden.has(id)).map((id) => listing(id, id)));
    const loadByIds = jest.fn(async (pageIds: string[]) =>
      pageIds.filter((id) => !hidden.has(id)).map((id) => listing(id, id))
    );
    const catalog = { collectPublicRentalListings: collect, loadPublicRentalListingsByIds: loadByIds };
    const cached = new RentalSearchService(catalog as never, hasura as never);
    const query = { country_code: 'CM', limit: 2 };
    const first = await cached.search({ ...query, page: 1 });
    expect(first.listings.map((row) => row.listing.id)).toEqual(['a', 'b']);
    expect(first.hasMore).toBe(true);
    expect(first.total).toBe(8);
    hidden.add('c');
    hidden.add('d');
    const second = await cached.search({ ...query, page: 2 });
    expect(second.listings.map((row) => row.listing.id)).toEqual(['e', 'f']);
    expect(second.hasMore).toBe(true);
    expect(second.total).toBe(6);
    expect(collect).toHaveBeenCalledTimes(2);
  });
});

async function captureUnhandledRejections(work: () => Promise<void>): Promise<unknown[]> {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    await work();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    return unhandled;
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}
