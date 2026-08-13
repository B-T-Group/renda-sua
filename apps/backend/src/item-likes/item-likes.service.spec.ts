jest.mock('../inventory-items/inventory-items.service', () => ({
  InventoryItemsService: class InventoryItemsService {},
}));

import { HttpException } from '@nestjs/common';
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

  it('likes an approved item', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        items_by_pk: {
          id: 'item-1',
          moderation_status: 'approved',
          likes_count: 0,
        },
      })
      .mockResolvedValueOnce({
        items_by_pk: { likes_count: 1 },
      });
    hasura.executeMutation.mockResolvedValue({});

    const result = await service.setLike('user-1', 'item-1', true);

    expect(result).toEqual({ liked: true, likes_count: 1 });
    expect(hasura.executeMutation).toHaveBeenCalled();
  });

  it('throws when item is missing', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ items_by_pk: null });
    await expect(
      service.setLike('user-1', 'missing', true)
    ).rejects.toBeInstanceOf(HttpException);
  });
});
