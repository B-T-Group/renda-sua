import { haversineMeters } from '../addresses/haversine';
import { GoogleCacheService } from './google-cache.service';

const ORIGIN_ID = 'd4182b35-9abc-4619-aa3f-f3244c4ef29c';
const DEST_A = '00000000-0000-4000-8000-000000000001';
const DEST_B = '00000000-0000-4000-8000-000000000002';

describe('GoogleCacheService.getValidCachedDistanceElements', () => {
  it('does not query Hasura for a non-uuid origin', async () => {
    const executeQuery = jest.fn();
    const service = new GoogleCacheService({ executeQuery } as any);

    const result = await service.getValidCachedDistanceElements(
      'anon:4.05000:9.70000',
      [DEST_A]
    );

    expect(result).toEqual([]);
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('returns only the pairs that are still valid in cache', async () => {
    const executeQuery = jest.fn().mockImplementation((query: string) => {
      if (query.includes('GetCachedDistanceMatrix')) {
        return {
          google_distance_cache: [
            {
              destination_address_id: DEST_A,
              destination_address_formatted: '1,0',
              origin_address_formatted: '0,0',
              distance_value: 100,
              distance_text: '100 m',
              duration_value: 30,
              duration_text: '1 min',
              status: 'OK',
              created_at: '2026-01-02T00:00:00Z',
            },
          ],
        };
      }
      if (query.includes('GetAddressUpdatedAts')) {
        return {
          addresses: [
            { id: ORIGIN_ID, updated_at: '2026-01-01T00:00:00Z' },
            { id: DEST_A, updated_at: '2026-01-01T00:00:00Z' },
            { id: DEST_B, updated_at: '2026-01-01T00:00:00Z' },
          ],
        };
      }
      return {};
    });
    const service = new GoogleCacheService({ executeQuery } as any);

    const partial = await service.getValidCachedDistanceElements(ORIGIN_ID, [
      DEST_A,
      DEST_B,
    ]);
    expect(partial).toHaveLength(1);
    expect(partial[0].destination_address_id).toBe(DEST_A);
  });
});

describe('GoogleCacheService.findNearbyCachedDistanceElements', () => {
  const nearbyOrigin = '00000000-0000-4000-8000-0000000000aa';

  function row(latitude: number, longitude: number) {
    return {
      origin_address_id: nearbyOrigin,
      destination_address_id: DEST_A,
      origin_address_formatted: `${latitude},${longitude}`,
      destination_address_formatted: 'store',
      origin_latitude: latitude,
      origin_longitude: longitude,
      distance_value: 1200,
      distance_text: '1.2 km',
      duration_value: 180,
      duration_text: '3 mins',
      status: 'OK',
      created_at: '2026-01-02T00:00:00Z',
    };
  }

  it('reuses a route whose origin is within 75 m and skips one farther away', async () => {
    const executeQuery = jest.fn().mockImplementation((query: string) => {
      if (query.includes('NearbyDistanceCache')) {
        return { google_distance_cache: [row(4.0503, 9.7), row(4.052, 9.7)] };
      }
      if (query.includes('GetAddressUpdatedAts')) {
        return {
          addresses: [
            { id: nearbyOrigin, updated_at: '2026-01-01T00:00:00Z' },
            { id: DEST_A, updated_at: '2026-01-01T00:00:00Z' },
          ],
        };
      }
      return {};
    });
    const service = new GoogleCacheService({ executeQuery } as any);

    const near = await service.findNearbyCachedDistanceElements(
      { lat: 4.05, lng: 9.7 },
      [DEST_A],
      75
    );
    expect(near).toHaveLength(1);
    expect(near[0].distance?.value).toBe(1200);

    executeQuery.mockImplementation((query: string) => {
      if (query.includes('NearbyDistanceCache')) {
        return { google_distance_cache: [row(4.052, 9.7)] };
      }
      return {
        addresses: [
          { id: nearbyOrigin, updated_at: '2026-01-01T00:00:00Z' },
          { id: DEST_A, updated_at: '2026-01-01T00:00:00Z' },
        ],
      };
    });
    const far = await service.findNearbyCachedDistanceElements(
      { lat: 4.05, lng: 9.7 },
      [DEST_A],
      75
    );
    expect(far).toEqual([]);
  });

  it('keeps an origin at 75 m and prefers the closer route', async () => {
    const edgeLat = 4.05 + (75 * 180) / (Math.PI * 6_371_000);
    const nearLat = 4.05 + (20 * 180) / (Math.PI * 6_371_000);
    expect(haversineMeters(4.05, 9.7, edgeLat, 9.7)).toBeLessThanOrEqual(75);
    expect(haversineMeters(4.05, 9.7, nearLat, 9.7)).toBeLessThan(75);
    const executeQuery = jest.fn().mockImplementation((query: string) => {
      if (query.includes('NearbyDistanceCache')) {
        return {
          google_distance_cache: [
            {
              ...row(edgeLat, 9.7),
              distance_value: 900,
              distance_text: '900 m',
            },
            {
              ...row(nearLat, 9.7),
              distance_value: 400,
              distance_text: '400 m',
            },
          ],
        };
      }
      return {
        addresses: [
          { id: nearbyOrigin, updated_at: '2026-01-01T00:00:00Z' },
          { id: DEST_A, updated_at: '2026-01-01T00:00:00Z' },
        ],
      };
    });
    const service = new GoogleCacheService({ executeQuery } as any);

    const reused = await service.findNearbyCachedDistanceElements(
      { lat: 4.05, lng: 9.7 },
      [DEST_A],
      75
    );

    expect(reused).toHaveLength(1);
    expect(reused[0].distance?.value).toBe(400);
  });

  it('does not reuse a route cached before the address changed', async () => {
    const executeQuery = jest.fn().mockImplementation((query: string) => {
      if (query.includes('NearbyDistanceCache')) {
        return { google_distance_cache: [row(4.0501, 9.7)] };
      }
      return {
        addresses: [
          { id: nearbyOrigin, updated_at: '2026-01-01T00:00:00Z' },
          { id: DEST_A, updated_at: '2026-02-01T00:00:00Z' },
        ],
      };
    });
    const service = new GoogleCacheService({ executeQuery } as any);

    await expect(
      service.findNearbyCachedDistanceElements(
        { lat: 4.05, lng: 9.7 },
        [DEST_A],
        75
      )
    ).resolves.toEqual([]);
  });

  it('returns nothing when the cache lookup fails or the origin cannot be searched', async () => {
    const executeQuery = jest.fn().mockRejectedValue(new Error('hasura down'));
    const service = new GoogleCacheService({ executeQuery } as any);

    await expect(
      service.findNearbyCachedDistanceElements(
        { lat: 4.05, lng: 9.7 },
        [DEST_A],
        75
      )
    ).resolves.toEqual([]);
    await expect(
      service.findNearbyCachedDistanceElements(
        { lat: 4.05, lng: 9.7 },
        ['not-a-uuid'],
        75
      )
    ).resolves.toEqual([]);
    await expect(
      service.findNearbyCachedDistanceElements(
        { lat: Number.NaN, lng: 9.7 },
        [DEST_A],
        75
      )
    ).resolves.toEqual([]);
    await expect(
      service.findNearbyCachedDistanceElements(
        { lat: 4.05, lng: 9.7 },
        [DEST_A],
        0
      )
    ).resolves.toEqual([]);
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });
});
