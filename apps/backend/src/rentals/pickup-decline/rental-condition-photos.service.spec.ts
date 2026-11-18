import { HttpException } from '@nestjs/common';
import { RentalConditionPhotosService } from './rental-condition-photos.service';
import { RentalDeclineCountsService } from './rental-decline-counts.service';

const ITEM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PHOTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function photos(options: { flag?: boolean; listing?: unknown; optIn?: boolean; rows?: unknown[] } = {}) {
  const queries: string[] = [];
  const signed: string[] = [];
  const hasura = {
    executeQuery: jest.fn(async (query: string) => {
      queries.push(query);
      if (query.includes('DeclineItemOptIn')) return { rental_items_by_pk: { id: ITEM, inspection_opt_in: options.optIn === true } };
      if (query.includes('PublicBaselinePhotos')) return { rental_item_baseline_photos: options.rows ?? [] };
      return {};
    }),
  };
  const service = new RentalConditionPhotosService(
    hasura as never,
    { getUser: jest.fn() } as never,
    { pickupDeclineEnabled: jest.fn(async () => options.flag !== false) } as never,
    { generatePresignedDownloadUrl: jest.fn(async (input: { key: string }) => { signed.push(input.key); return { url: `https://signed/${input.key}`, expiresAt: new Date('2026-11-18T00:00:00.000Z') }; }) } as never,
    { getPublicRentalListingById: jest.fn(async () => options.listing ?? null) } as never
  );
  return { service, queries, signed };
}

describe('public condition photos', () => {
  const listing = { rental_item: { id: ITEM } };
  const row = (slot: string, key: string) => ({ id: PHOTO, slot_key: slot, object_key: key, captured_at: '2026-11-01', status: 'ready' });
  const baseline = (slot: string) => row(slot, `dev/rental-inspection/baseline/${ITEM}/${PHOTO}.jpg`.replace(PHOTO, slot === 'overview' ? PHOTO : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'));

  it('returns nothing when the flag is off', async () => {
    const { service, queries } = photos({ flag: false, listing });
    await expect(service.forListing(LISTING)).rejects.toBeInstanceOf(HttpException);
    expect(queries).toHaveLength(0);
  });

  it('hides a listing that is not opted in or whose baseline is incomplete', async () => {
    const optedOut = photos({ listing, optIn: false });
    await expect(optedOut.service.forListing(LISTING)).rejects.toMatchObject({ status: 404 });
    expect(optedOut.queries.some((query) => query.includes('PublicBaselinePhotos'))).toBe(false);
    const thin = photos({ listing, optIn: true, rows: [baseline('overview')] });
    await expect(thin.service.forListing(LISTING)).rejects.toMatchObject({ status: 404 });
    expect(thin.signed).toHaveLength(0);
  });

  it('signs only baseline keys', async () => {
    const declineKey = `dev/rental-inspection/decline/${LISTING}/${PHOTO}.jpg`;
    const { service, signed, queries } = photos({
      listing,
      optIn: true,
      rows: [baseline('overview'), baseline('other_side'), baseline('accessories'), row('overview', declineKey)],
    });
    const result = await service.forListing(LISTING);
    expect(result.photos).toHaveLength(3);
    expect(signed.every((key) => key.includes('/baseline/'))).toBe(true);
    expect(signed).not.toContain(declineKey);
    expect(queries.some((query) => query.includes('rental_inspection_media'))).toBe(false);
  });
});

describe('decline counters', () => {
  it('flags five declines and returns pickup reach beside a business', async () => {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('ConditionDeclineCounts90')) {
          return {
            rental_condition_decline_counts_90d: [
              { id: 'renter:c', role: 'renter', party_id: 'c', decline_count: 4, last_decline_at: '2026-11-01' },
              { id: 'business:b', role: 'business', party_id: 'b', decline_count: 5, last_decline_at: '2026-11-02' },
            ],
            rental_business_pickup_reach_90d: [{ business_id: 'b', pickups_reached: 12 }],
          };
        }
        return { clients: [{ id: 'c', user: { first_name: 'Jean', last_name: 'K' } }], businesses: [{ id: 'b', name: 'Studio Akwa' }] };
      }),
    };
    const service = new RentalDeclineCountsService(hasura as never, { pickupDeclineEnabled: async () => true } as never);
    const result = await service.list();
    expect(result.threshold).toBe(5);
    expect(result.parties.find((row) => row.role === 'renter')?.flagged).toBe(false);
    const business = result.parties.find((row) => row.role === 'business');
    expect(business?.flagged).toBe(true);
    expect(business?.pickupsReached).toBe(12);
    expect(business?.name).toBe('Studio Akwa');
  });

  it('returns null stats when the flag is off', async () => {
    const hasura = { executeQuery: jest.fn() };
    const service = new RentalDeclineCountsService(hasura as never, { pickupDeclineEnabled: async () => false } as never);
    await expect(service.forBusiness('b')).resolves.toBeNull();
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });
});
