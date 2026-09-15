import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessFollowsService } from './business-follows.service';

describe('BusinessFollowsService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };

  let service: BusinessFollowsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessFollowsService(hasura as any);
  });

  function activeBusiness(followersCount = 0) {
    return {
      businesses_by_pk: {
        id: 'biz-1',
        name: 'Acme',
        lifecycle_status: 'active',
        followers_count: followersCount,
      },
    };
  }

  describe('setFollow', () => {
    it('follows an active business', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce(activeBusiness(0))
        .mockResolvedValueOnce({
          businesses_by_pk: { followers_count: 1 },
        });
      hasura.executeMutation.mockResolvedValue({});

      const result = await service.setFollow('user-1', 'biz-1', true);

      expect(result).toEqual({ following: true, followers_count: 1 });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('InsertBusinessFollow'),
        { userId: 'user-1', businessId: 'biz-1' }
      );
    });

    it('unfollows an active business', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce(activeBusiness(2))
        .mockResolvedValueOnce({
          businesses_by_pk: { followers_count: 1 },
        });
      hasura.executeMutation.mockResolvedValue({
        delete_business_follows: { affected_rows: 1 },
      });

      const result = await service.setFollow('user-1', 'biz-1', false);

      expect(result).toEqual({ following: false, followers_count: 1 });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('DeleteBusinessFollow'),
        { userId: 'user-1', businessId: 'biz-1' }
      );
    });

    it('throws when business is missing', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ businesses_by_pk: null });
      await expect(
        service.setFollow('user-1', 'missing', true)
      ).rejects.toBeInstanceOf(HttpException);
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects suspended businesses', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        businesses_by_pk: {
          id: 'biz-1',
          name: 'Acme',
          lifecycle_status: 'suspended',
          followers_count: 0,
        },
      });

      const error = await service
        .setFollow('user-1', 'biz-1', true)
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('falls back to zero followers when refresh is missing', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce(activeBusiness(0))
        .mockResolvedValueOnce({ businesses_by_pk: null });
      hasura.executeMutation.mockResolvedValue({});

      await expect(
        service.setFollow('user-1', 'biz-1', true)
      ).resolves.toEqual({
        following: true,
        followers_count: 0,
      });
    });
  });

  describe('getFollowedBusinessIdSet', () => {
    it('returns an empty set for anonymous or empty input without querying', async () => {
      await expect(
        service.getFollowedBusinessIdSet('anonymous', ['a'])
      ).resolves.toEqual(new Set());
      await expect(service.getFollowedBusinessIdSet('', ['a'])).resolves.toEqual(
        new Set()
      );
      await expect(
        service.getFollowedBusinessIdSet('user-1', [])
      ).resolves.toEqual(new Set());
      expect(hasura.executeQuery).not.toHaveBeenCalled();
    });

    it('maps followed business ids', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        business_follows: [{ business_id: 'a' }, { business_id: 'c' }],
      });

      await expect(
        service.getFollowedBusinessIdSet('user-1', ['a', 'b', 'c'])
      ).resolves.toEqual(new Set(['a', 'c']));
    });

    it('fails soft when Hasura throws', async () => {
      hasura.executeQuery.mockRejectedValueOnce(new Error('unavailable'));

      await expect(
        service.getFollowedBusinessIdSet('user-1', ['a'])
      ).resolves.toEqual(new Set());
    });
  });

  describe('getUserFollows', () => {
    function mockFollowIds(businessIds: string[]) {
      hasura.executeQuery.mockResolvedValueOnce({
        business_follows_aggregate: {
          aggregate: { count: businessIds.length },
        },
        business_follows: businessIds.map((business_id) => ({ business_id })),
      });
    }

    it('returns an empty page when the user has no follows', async () => {
      mockFollowIds([]);

      await expect(service.getUserFollows('user-1')).resolves.toEqual({
        businesses: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it('marks resolved businesses following and paginates', async () => {
      mockFollowIds(['a', 'b']);
      hasura.executeQuery.mockResolvedValueOnce({
        businesses: [
          {
            id: 'a',
            name: 'A',
            lifecycle_status: 'active',
            followers_count: 1,
          },
          {
            id: 'b',
            name: 'B',
            lifecycle_status: 'active',
            followers_count: 2,
          },
        ],
      });

      const page = await service.getUserFollows('user-1', 2, 1);

      expect(page.total).toBe(2);
      expect(page.page).toBe(2);
      expect(page.limit).toBe(1);
      expect(page.totalPages).toBe(2);
      expect(page.businesses).toEqual([
        { id: 'b', name: 'B', followers_count: 2, following: true },
      ]);
    });

    it('clamps invalid page and limit', async () => {
      mockFollowIds([]);

      const page = await service.getUserFollows('user-1', Number.NaN, 999);

      expect(page.page).toBe(1);
      expect(page.limit).toBe(50);
    });

    it('keeps follow total when businesses cannot be resolved', async () => {
      mockFollowIds(['gone']);
      hasura.executeQuery.mockResolvedValueOnce({ businesses: [] });

      await expect(service.getUserFollows('user-1')).resolves.toEqual({
        businesses: [],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('drops suspended businesses from the page but keeps resolved ones', async () => {
      mockFollowIds(['a', 'gone']);
      hasura.executeQuery.mockResolvedValueOnce({
        businesses: [
          {
            id: 'a',
            name: 'A',
            lifecycle_status: 'active',
            followers_count: 1,
          },
          {
            id: 'gone',
            name: 'Gone',
            lifecycle_status: 'suspended',
            followers_count: 0,
          },
        ],
      });

      const page = await service.getUserFollows('user-1');
      expect(page.total).toBe(1);
      expect(page.businesses).toEqual([
        { id: 'a', name: 'A', followers_count: 1, following: true },
      ]);
    });
  });
});
