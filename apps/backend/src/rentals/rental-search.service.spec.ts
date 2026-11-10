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
});
