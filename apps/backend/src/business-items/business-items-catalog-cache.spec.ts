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

describe('BusinessItemsService catalog cache invalidation', () => {
  const businessId = 'biz-1';
  const itemId = 'item-1';

  const createService = () => {
    const hasuraUserService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const catalogCacheService = {
      incrementGeneration: jest.fn().mockResolvedValue(9),
    };
    const service = new BusinessItemsService(
      hasuraUserService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { recompute: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      catalogCacheService as any
    );
    return { service, hasuraUserService, catalogCacheService };
  };

  it('bumps the global catalog generation after a promotion write', async () => {
    const { service, hasuraUserService, catalogCacheService } = createService();
    hasuraUserService.executeQuery.mockResolvedValue({
      items_by_pk: { id: itemId, business_id: businessId },
    });
    hasuraUserService.executeMutation.mockResolvedValue({
      update_business_inventory: { affected_rows: 2 },
    });

    await expect(
      service.setPromotionForItem(businessId, itemId, { promoted: true })
    ).resolves.toEqual({ affected_rows: 2 });

    expect(catalogCacheService.incrementGeneration).toHaveBeenCalledWith(
      'global'
    );
  });

  it('does not bust the catalog cache when the item is not owned', async () => {
    const { service, hasuraUserService, catalogCacheService } = createService();
    hasuraUserService.executeQuery.mockResolvedValue({
      items_by_pk: { id: itemId, business_id: 'other-biz' },
    });

    try {
      await service.setPromotionForItem(businessId, itemId, { promoted: true });
      fail('expected not found');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
    expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    expect(catalogCacheService.incrementGeneration).not.toHaveBeenCalled();
  });
});
