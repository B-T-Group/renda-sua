import { FOOD_CATEGORY_NAME } from '../food/food.constants';
import { CommerceInventorySyncService } from './commerce-inventory-sync.service';

describe('CommerceInventorySyncService.applyShopifyAvailable', () => {
  const params = {
    integrationId: 'int-1',
    provider: 'shopify' as const,
    variantId: 'var-1',
    businessLocationId: 'loc-1',
    available: 12,
    externalInventoryItemId: 'ext-item',
    externalLocationId: 'ext-loc',
    trigger: 'WEBHOOK' as const,
  };

  function createService(categoryName: string) {
    const executeQuery = jest.fn().mockResolvedValue({
      business_inventory: [
        {
          id: 'inv-1',
          quantity: 1,
          reserved_quantity: 2,
          item: {
            item_sub_category: {
              item_category: { name: categoryName },
            },
          },
        },
      ],
    });
    const executeMutation = jest.fn().mockResolvedValue({
      update_business_inventory_by_pk: { id: 'inv-1' },
    });
    const recordSyncEvent = jest.fn();
    const service = new CommerceInventorySyncService(
      { recordSyncEvent } as any,
      {} as any,
      {} as any,
      { executeQuery, executeMutation } as any,
      {} as any
    );
    return { service, executeMutation, recordSyncEvent };
  }

  it('does not overwrite cooked-food sentinel quantity from Shopify', async () => {
    const { service, executeMutation, recordSyncEvent } = createService(
      FOOD_CATEGORY_NAME
    );

    await expect(service.applyShopifyAvailable(params)).resolves.toBe(false);

    expect(executeMutation).not.toHaveBeenCalled();
    expect(recordSyncEvent).not.toHaveBeenCalled();
  });

  it('writes retail on-hand as Shopify available plus reserved', async () => {
    const { service, executeMutation, recordSyncEvent } = createService(
      'Retail & Shopping'
    );

    await expect(service.applyShopifyAvailable(params)).resolves.toBe(true);

    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('update_business_inventory_by_pk'),
      { id: 'inv-1', quantity: 14 }
    );
    expect(recordSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        internal_entity_id: 'inv-1',
        metadata: expect.objectContaining({
          shopifyAvailable: 12,
          previousQuantity: 1,
          newQuantity: 14,
        }),
      })
    );
  });
});
