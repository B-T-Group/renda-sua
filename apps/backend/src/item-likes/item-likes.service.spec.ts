jest.mock('../inventory-items/inventory-items.service', () => ({
  InventoryItemsService: class InventoryItemsService {},
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { ItemLikesService } from './item-likes.service';

describe('ItemLikesService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const inventoryItems = {
    getBestListingsForCatalogItemIds: jest.fn(),
  };

  let service: ItemLikesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ItemLikesService(hasura as any, inventoryItems as any);
  });

  function approvedItem(likesCount = 0) {
    return {
      items_by_pk: {
        id: 'item-1',
        moderation_status: 'approved',
        likes_count: likesCount,
      },
    };
  }

  describe('setLike', () => {
    it('likes an approved item', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce(approvedItem(0))
        .mockResolvedValueOnce({ items_by_pk: { likes_count: 1 } });
      hasura.executeMutation.mockResolvedValue({});

      const result = await service.setLike('user-1', 'item-1', true);

      expect(result).toEqual({ liked: true, likes_count: 1 });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('InsertUserItemLike'),
        { userId: 'user-1', itemId: 'item-1' }
      );
    });

    it('unlikes an approved item', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce(approvedItem(2))
        .mockResolvedValueOnce({ items_by_pk: { likes_count: 1 } });
      hasura.executeMutation.mockResolvedValue({
        delete_user_item_likes: { affected_rows: 1 },
      });

      const result = await service.setLike('user-1', 'item-1', false);

      expect(result).toEqual({ liked: false, likes_count: 1 });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('DeleteUserItemLike'),
        { userId: 'user-1', itemId: 'item-1' }
      );
    });

    it('throws when item is missing', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ items_by_pk: null });
      await expect(
        service.setLike('user-1', 'missing', true)
      ).rejects.toBeInstanceOf(HttpException);
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects unapproved catalog items', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        items_by_pk: {
          id: 'item-1',
          moderation_status: 'pending',
          likes_count: 0,
        },
      });

      const error = await service
        .setLike('user-1', 'item-1', true)
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('falls back to zero likes when refresh is missing', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce(approvedItem(0))
        .mockResolvedValueOnce({ items_by_pk: null });
      hasura.executeMutation.mockResolvedValue({});

      await expect(service.setLike('user-1', 'item-1', true)).resolves.toEqual({
        liked: true,
        likes_count: 0,
      });
    });
  });

  describe('getLikedItemIdSet', () => {
    it('returns an empty set for anonymous or empty input without querying', async () => {
      await expect(service.getLikedItemIdSet('anonymous', ['a'])).resolves.toEqual(
        new Set()
      );
      await expect(service.getLikedItemIdSet('', ['a'])).resolves.toEqual(
        new Set()
      );
      await expect(service.getLikedItemIdSet('user-1', [])).resolves.toEqual(
        new Set()
      );
      expect(hasura.executeQuery).not.toHaveBeenCalled();
    });

    it('maps liked item ids', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        user_item_likes: [{ item_id: 'a' }, { item_id: 'c' }],
      });

      await expect(
        service.getLikedItemIdSet('user-1', ['a', 'b', 'c'])
      ).resolves.toEqual(new Set(['a', 'c']));
    });

    it('fails soft when Hasura throws', async () => {
      hasura.executeQuery.mockRejectedValueOnce(new Error('unavailable'));

      await expect(
        service.getLikedItemIdSet('user-1', ['a'])
      ).resolves.toEqual(new Set());
    });
  });

  describe('getUserLikes', () => {
    function mockLikeIds(itemIds: string[]) {
      hasura.executeQuery.mockResolvedValueOnce({
        user_item_likes_aggregate: { aggregate: { count: itemIds.length } },
        user_item_likes: itemIds.map((item_id) => ({ item_id })),
      });
    }

    it('returns an empty page when the user has no likes', async () => {
      mockLikeIds([]);

      await expect(service.getUserLikes('user-1')).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      expect(
        inventoryItems.getBestListingsForCatalogItemIds
      ).toHaveBeenCalledWith([]);
    });

    it('marks resolved listings liked and paginates', async () => {
      mockLikeIds(['a', 'b']);
      inventoryItems.getBestListingsForCatalogItemIds.mockResolvedValueOnce([
        { item_id: 'a', id: 'inv-a' },
        { item_id: 'b', id: 'inv-b' },
      ]);

      const page = await service.getUserLikes('user-1', 2, 1);

      expect(page.total).toBe(2);
      expect(page.page).toBe(2);
      expect(page.limit).toBe(1);
      expect(page.totalPages).toBe(2);
      expect(page.items).toEqual([{ item_id: 'b', id: 'inv-b', liked: true }]);
    });

    it('clamps invalid page and limit', async () => {
      mockLikeIds([]);

      const page = await service.getUserLikes('user-1', Number.NaN, 999);

      expect(page.page).toBe(1);
      expect(page.limit).toBe(50);
    });

    it('keeps like total when listings cannot be resolved', async () => {
      mockLikeIds(['gone']);
      inventoryItems.getBestListingsForCatalogItemIds.mockResolvedValueOnce([]);

      await expect(service.getUserLikes('user-1')).resolves.toEqual({
        items: [],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('drops unresolved listings from the page but keeps resolved ones', async () => {
      mockLikeIds(['a', 'gone']);
      inventoryItems.getBestListingsForCatalogItemIds.mockResolvedValueOnce([
        { item_id: 'a', id: 'inv-a' },
      ]);

      const page = await service.getUserLikes('user-1');
      expect(page.total).toBe(1);
      expect(page.items).toEqual([{ item_id: 'a', id: 'inv-a', liked: true }]);
    });
  });
});
