import { VariantInventoryService } from './variant-inventory.service';

describe('VariantInventoryService.stockForPurchase', () => {
  it('keeps the variant inventory row when the order already points at it', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      business_inventory_by_pk: {
        id: 'variant-inv',
        item_variant_id: 'pack',
        quantity: 20,
        reserved_quantity: 4,
      },
    });
    const service = new VariantInventoryService({
      executeQuery,
      executeMutation: jest.fn(),
    } as never);

    await expect(service.stockForPurchase('variant-inv', 'pack')).resolves.toEqual({
      id: 'variant-inv',
      computed_available_quantity: 16,
    });
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it('seeds from the parent when the line points at a different variant row', async () => {
    const executeQuery = jest.fn(async (query: string) => {
      if (String(query).includes('InventoryById')) {
        return {
          business_inventory_by_pk: {
            id: 'other-variant',
            item_variant_id: 'color',
            business_location_id: 'loc',
            item_id: 'item',
            quantity: 3,
            reserved_quantity: 0,
          },
        };
      }
      if (String(query).includes('ParentAtLocation')) {
        return {
          business_inventory: [
            {
              id: 'parent',
              item_variant_id: null,
              business_location_id: 'loc',
              item_id: 'item',
              quantity: 8,
              reserved_quantity: 1,
              selling_price: 5,
              unit_cost: null,
              reorder_point: 0,
              reorder_quantity: 0,
              is_active: true,
            },
          ],
        };
      }
      return { business_inventory: [] };
    });
    const executeMutation = jest.fn().mockResolvedValue({
      insert_business_inventory_one: {
        id: 'pack-inv',
        computed_available_quantity: 7,
      },
    });
    const service = new VariantInventoryService({
      executeQuery,
      executeMutation,
    } as never);

    await expect(service.stockForPurchase('other-variant', 'pack')).resolves.toEqual({
      id: 'pack-inv',
      computed_available_quantity: 7,
    });
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertVariantStock'),
      expect.objectContaining({
        object: expect.objectContaining({
          item_variant_id: 'pack',
          quantity: 8,
          reserved_quantity: 1,
        }),
      })
    );
  });
});
