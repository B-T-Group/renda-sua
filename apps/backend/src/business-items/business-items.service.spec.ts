jest.mock('../business-images/business-images.service', () => ({
  BusinessImagesService: class BusinessImagesService {},
}));
jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: class ItemAiReviewService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { BusinessItemsService } from './business-items.service';
import type { CsvItemRowDto } from './dto/csv-upload.dto';

describe('BusinessItemsService CSV upload', () => {
  const businessId = 'business-1';
  const userId = 'user-1';
  const row: CsvItemRowDto = {
    name: 'Approved item',
    description: 'Updated description',
    price: 25,
    currency: 'USD',
    sku: 'SKU-1',
    business_location_name: 'Main Store',
    quantity: 10,
    reserved_quantity: 0,
    reorder_point: 2,
    reorder_quantity: 5,
    unit_cost: 12,
    selling_price: 25,
  };

  const createService = (existingItem: {
    is_active: boolean;
    moderation_status: string;
  }) => {
    const hasuraUserService = {
      executeQuery: jest.fn((query: string) => {
        if (query.includes('query GetItems')) {
          return Promise.resolve({
            items: [
              {
                id: 'item-1',
                name: row.name,
                sku: row.sku,
                is_active: existingItem.is_active,
                moderation_status: existingItem.moderation_status,
                business_inventories: [],
              },
            ],
          });
        }
        if (query.includes('query GetBusinessLocations')) {
          return Promise.resolve({
            business_locations: [{ id: 'location-1', name: 'Main Store' }],
          });
        }
        if (query.includes('query GetBusinessInventory')) {
          return Promise.resolve({ business_inventory: [] });
        }
        if (query.includes('query GetItemSubCategoryIds')) {
          return Promise.resolve({ item_sub_categories: [] });
        }
        return Promise.resolve({});
      }),
      executeMutation: jest.fn(() => Promise.resolve({})),
    };
    const hasuraSystemService = {
      resolveBusinessCurrency: jest.fn().mockResolvedValue('CAD'),
      executeQuery: jest.fn().mockResolvedValue({
        items_by_pk: {
          id: 'item-1',
          business_id: businessId,
          moderation_status: existingItem.moderation_status,
          name: row.name,
          description: row.description,
          status: 'active',
        },
      }),
      executeMutation: jest.fn().mockResolvedValue({
        update_items: {
          affected_rows: 1,
          returning: [{ id: 'item-1', moderation_status: 'pending' }],
        },
      }),
    };
    const itemsService = {
      updateItem: jest.fn().mockResolvedValue({ id: 'item-1' }),
    };
    const itemAiReviewService = {
      requestReview: jest.fn(),
      resubmitIfRejected: jest.fn(),
    };
    const merchantLifecycleService = { recompute: jest.fn() };

    const service = new BusinessItemsService(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      {} as any,
      itemsService as any,
      itemAiReviewService as any,
      {} as any,
      {} as any,
      merchantLifecycleService as any,
      {} as any
    );

    return {
      service,
      hasuraSystemService,
      itemsService,
      itemAiReviewService,
    };
  };

  it('keeps approved active items active when updating them by CSV', async () => {
    const { service, itemsService, hasuraSystemService, itemAiReviewService } =
      createService({ is_active: true, moderation_status: 'approved' });

    await service.processCsvRows(businessId, userId, [row]);

    expect(itemsService.updateItem).toHaveBeenCalledWith(
      businessId,
      'item-1',
      expect.objectContaining({ is_active: true, currency: 'CAD' })
    );
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(itemAiReviewService.requestReview).not.toHaveBeenCalled();
  });

  it('keeps draft items inactive when updating them by CSV', async () => {
    const { service, itemsService, itemAiReviewService } = createService({
      is_active: true,
      moderation_status: 'draft',
    });

    await service.processCsvRows(businessId, userId, [row]);

    expect(itemsService.updateItem).toHaveBeenCalledWith(
      businessId,
      'item-1',
      expect.objectContaining({ is_active: false })
    );
    expect(itemAiReviewService.requestReview).toHaveBeenCalledWith('item-1');
  });
});
