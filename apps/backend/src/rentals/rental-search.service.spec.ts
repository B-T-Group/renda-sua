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
});
