jest.mock('../business-images/business-images.service', () => ({
  BusinessImagesService: class BusinessImagesService {},
}));
jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: class ItemAiReviewService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessItemsService } from './business-items.service';

describe('BusinessItemsService.deleteItem', () => {
  const businessId = 'biz-1';
  const itemId = 'item-1';

  const createService = () => {
    const hasuraUserService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const catalogCacheService = {
      incrementGeneration: jest.fn().mockResolvedValue(1),
    };
    const merchantLifecycleService = {
      recompute: jest.fn(),
    };
    const service = new BusinessItemsService(
      hasuraUserService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      merchantLifecycleService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      catalogCacheService as any
    );
    return {
      service,
      hasuraUserService,
      catalogCacheService,
      merchantLifecycleService,
    };
  };

  const ownedItem = {
    items_by_pk: { id: itemId, business_id: businessId },
  };

  it('deactivates stock, deletes unused inventory, then marks the item deleted', async () => {
    const { service, hasuraUserService, catalogCacheService } = createService();
    hasuraUserService.executeQuery.mockResolvedValue(ownedItem);
    hasuraUserService.executeMutation.mockResolvedValue({});

    await service.deleteItem(businessId, itemId);

    const mutations = hasuraUserService.executeMutation.mock.calls.map(
      ([query]) => String(query)
    );
    expect(mutations[0]).toContain('update_business_inventory');
    expect(mutations[0]).toContain('is_active: false');
    expect(mutations[1]).toContain('delete_business_inventory');
    expect(mutations[1]).toContain('_not: { order_items: {} }');
    expect(mutations[1]).toContain('reserved_quantity: { _eq: 0 }');
    expect(mutations[1]).toContain('item_id: { _eq: $itemId }');
    expect(mutations[2]).toContain('update_items_by_pk');
    expect(hasuraUserService.executeMutation).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      { itemId, status: 'deleted' }
    );
    expect(catalogCacheService.incrementGeneration).toHaveBeenCalledWith(
      'global'
    );
  });

  it('still deletes the item when leftover inventory is referenced by orders', async () => {
    const { service, hasuraUserService } = createService();
    hasuraUserService.executeQuery.mockResolvedValue(ownedItem);
    hasuraUserService.executeMutation.mockImplementation((query: string) => {
      if (String(query).includes('delete_business_inventory')) {
        return Promise.reject({
          message:
            'Foreign key violation. update or delete on table "business_inventory" violates foreign key constraint "order_items_business_inventory_id_fkey" on table "order_items"',
          response: {
            errors: [
              {
                message:
                  'Foreign key violation. update or delete on table "business_inventory" violates foreign key constraint "order_items_business_inventory_id_fkey" on table "order_items"',
              },
            ],
          },
        });
      }
      return Promise.resolve({});
    });

    await expect(service.deleteItem(businessId, itemId)).resolves.toBeUndefined();
    expect(hasuraUserService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('update_items_by_pk'),
      { itemId, status: 'deleted' }
    );
  });

  it('rethrows unexpected inventory delete errors', async () => {
    const { service, hasuraUserService } = createService();
    hasuraUserService.executeQuery.mockResolvedValue(ownedItem);
    const unexpected = new Error('Hasura unavailable');
    hasuraUserService.executeMutation.mockImplementation((query: string) => {
      if (String(query).includes('delete_business_inventory')) {
        return Promise.reject(unexpected);
      }
      return Promise.resolve({});
    });

    await expect(service.deleteItem(businessId, itemId)).rejects.toBe(unexpected);
  });

  it('returns 404 when the item is missing', async () => {
    const { service, hasuraUserService } = createService();
    hasuraUserService.executeQuery.mockResolvedValue({ items_by_pk: null });

    try {
      await service.deleteItem(businessId, itemId);
      fail('expected not found');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
    expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
  });

  it('returns 403 when the item belongs to another business', async () => {
    const { service, hasuraUserService } = createService();
    hasuraUserService.executeQuery.mockResolvedValue({
      items_by_pk: { id: itemId, business_id: 'other-biz' },
    });

    try {
      await service.deleteItem(businessId, itemId);
      fail('expected forbidden');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
    expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
  });
});
