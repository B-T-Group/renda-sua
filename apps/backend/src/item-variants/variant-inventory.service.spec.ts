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

  it('reuses an existing variant row instead of seeding a second stock pile', async () => {
    const executeQuery = jest.fn(async (query: string) => {
      if (String(query).includes('InventoryById')) return inventoryRow('color');
      if (String(query).includes('ParentAtLocation')) return { business_inventory: [parentRow()] };
      if (String(query).includes('FindVariantStock')) {
        return {
          business_inventory: [{ id: 'existing-pack', computed_available_quantity: 4 }],
        };
      }
      return { business_inventory: [] };
    });
    const executeMutation = jest.fn();
    const service = new VariantInventoryService({ executeQuery, executeMutation } as never);

    await expect(service.stockForPurchase('other-variant', 'pack')).resolves.toEqual({
      id: 'existing-pack',
      computed_available_quantity: 4,
    });
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a missing parent and a row that is already a variant', async () => {
    const missing = new VariantInventoryService({
      executeQuery: jest.fn().mockResolvedValue({ business_inventory_by_pk: null }),
      executeMutation: jest.fn(),
    } as never);
    await expect(missing.ensureForLine('gone', 'pack')).rejects.toThrow(
      'Parent inventory not found'
    );

    const variantRow = new VariantInventoryService({
      executeQuery: jest.fn().mockResolvedValue(inventoryRow('color')),
      executeMutation: jest.fn(),
    } as never);
    await expect(variantRow.ensureForLine('other-variant', 'pack')).rejects.toThrow(
      'Parent inventory not found'
    );
  });

  it('seeds only locations that do not already have the variant', async () => {
    const executeQuery = jest.fn();
    executeQuery.mockImplementation(async (query: string, variables: { locationId?: string }) => {
      if (String(query).includes('ParentStock')) {
        return {
          business_inventory: [
            parentRow({ id: 'parent-a', business_location_id: 'loc-a' }),
            parentRow({ id: 'parent-b', business_location_id: 'loc-b', is_active: null }),
          ],
        };
      }
      if (variables.locationId === 'loc-a') {
        return {
          business_inventory: [{ id: 'existing', computed_available_quantity: 8 }],
        };
      }
      return { business_inventory: [] };
    });
    const executeMutation = jest.fn().mockResolvedValue({
      insert_business_inventory_one: { id: 'pack-b', computed_available_quantity: 7 },
    });
    const service = new VariantInventoryService({ executeQuery, executeMutation } as never);

    await service.seedFromParentStock('item', 'pack');

    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertVariantStock'),
      expect.objectContaining({
        object: expect.objectContaining({
          business_location_id: 'loc-b',
          is_active: true,
        }),
      })
    );
  });

  it('throws when the variant stock insert does not return a row', async () => {
    const executeQuery = jest.fn(async (query: string) => {
      if (String(query).includes('InventoryById')) return inventoryRow('color');
      if (String(query).includes('ParentAtLocation')) return { business_inventory: [parentRow()] };
      return { business_inventory: [] };
    });
    const service = new VariantInventoryService({
      executeQuery,
      executeMutation: jest.fn().mockResolvedValue({ insert_business_inventory_one: null }),
    } as never);

    await expect(service.stockForPurchase('other-variant', 'pack')).rejects.toThrow(
      'Failed to seed variant inventory'
    );
  });
});

describe('VariantInventoryService.retargetLines', () => {
  it('points the checkout line at the variant stock and drops the parent variant', async () => {
    const current = {
      id: 'parent',
      item_variant_id: null,
      item_variant: { id: 'stale' },
      computed_available_quantity: 99,
      selling_price: 10,
    };
    const inventoryById = new Map<string, any>([['parent', current]]);
    const line = { business_inventory_id: 'parent', item_variant_id: 'pack' };
    const executeQuery = jest.fn(async (query: string) => {
      if (String(query).includes('InventoryById')) {
        return { business_inventory_by_pk: parentRow() };
      }
      return {
        business_inventory: [{ id: 'pack-inv', computed_available_quantity: 4 }],
      };
    });
    const service = new VariantInventoryService({
      executeQuery,
      executeMutation: jest.fn(),
    } as never);

    await service.retargetLines([line], inventoryById);

    expect(line.business_inventory_id).toBe('pack-inv');
    expect(inventoryById.get('pack-inv')).toEqual({
      id: 'pack-inv',
      computed_available_quantity: 4,
      selling_price: 10,
    });
  });

  it('refreshes available units when the line already points at the variant', async () => {
    const current = { id: 'pack-inv', computed_available_quantity: 99 };
    const inventoryById = new Map<string, any>([['pack-inv', current]]);
    const line = { business_inventory_id: 'pack-inv', item_variant_id: 'pack' };
    const service = new VariantInventoryService({
      executeQuery: jest.fn().mockResolvedValue({
        business_inventory_by_pk: {
          ...parentRow(),
          id: 'pack-inv',
          item_variant_id: 'pack',
          quantity: 20,
          reserved_quantity: 4,
        },
      }),
      executeMutation: jest.fn(),
    } as never);

    await service.retargetLines([line], inventoryById);

    expect(line.business_inventory_id).toBe('pack-inv');
    expect(current.computed_available_quantity).toBe(16);
  });

  it('leaves a line alone when it has no variant', async () => {
    const executeQuery = jest.fn();
    const service = new VariantInventoryService({
      executeQuery,
      executeMutation: jest.fn(),
    } as never);
    const line = { business_inventory_id: 'parent', item_variant_id: null };

    await service.retargetLines([line], new Map());

    expect(line.business_inventory_id).toBe('parent');
    expect(executeQuery).not.toHaveBeenCalled();
  });
});

describe('VariantInventoryService.attachAvailableQuantities', () => {
  it('stamps variant stock for the listing location only', async () => {
    const pack = { id: 'pack', available_quantity: null as number | null };
    const color = { id: 'color', available_quantity: null as number | null };
    const other = { id: 'pack', available_quantity: null as number | null };
    const items = [
      {
        business_location: { id: 'loc-1' },
        item: { id: 'item-1', item_variants: [pack, color] },
      },
      {
        business_location_id: 'loc-2',
        item_id: 'item-2',
        item: { item_variants: [other] },
      },
    ];
    const executeQuery = jest.fn().mockResolvedValue({
      business_inventory: [
        stockListing('loc-1', 'pack', 7),
        stockListing('loc-9', 'pack', 99),
        stockListing('loc-1', 'color', 2),
      ],
    });
    const service = new VariantInventoryService({
      executeQuery,
      executeMutation: jest.fn(),
    } as never);

    await service.attachAvailableQuantities(items);

    expect(pack.available_quantity).toBe(7);
    expect(color.available_quantity).toBe(2);
    expect(other.available_quantity).toBeNull();
  });

  it('does not query when the page has no items', async () => {
    const executeQuery = jest.fn();
    const service = new VariantInventoryService({
      executeQuery,
      executeMutation: jest.fn(),
    } as never);

    await expect(service.attachAvailableQuantities([])).resolves.toEqual([]);
    expect(executeQuery).not.toHaveBeenCalled();
  });
});

function parentRow(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function inventoryRow(variantId: string) {
  return {
    business_inventory_by_pk: {
      id: 'other-variant',
      item_variant_id: variantId,
      business_location_id: 'loc',
      item_id: 'item',
      quantity: 3,
      reserved_quantity: 0,
    },
  };
}

function stockListing(locationId: string, variantId: string, quantity: number) {
  return {
    item_id: 'item-1',
    item_variant_id: variantId,
    business_location_id: locationId,
    computed_available_quantity: quantity,
  };
}
