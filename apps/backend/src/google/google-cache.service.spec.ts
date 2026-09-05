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
