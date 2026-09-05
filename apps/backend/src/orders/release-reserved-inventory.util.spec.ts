import {
  aggregateReservedQuantities,
  releaseReservedInventory,
} from './release-reserved-inventory.util';

describe('releaseReservedInventory', () => {
  it('aggregates duplicate inventory lines', () => {
    const qty = aggregateReservedQuantities([
      { business_inventory_id: 'inv-1', quantity: 2 },
      { business_inventory_id: 'inv-1', quantity: 3 },
      { business_inventory_id: 'inv-2', quantity: 1 },
      { business_inventory_id: null, quantity: 4 },
    ]);
    expect([...qty.entries()]).toEqual([
      ['inv-1', 5],
      ['inv-2', 1],
    ]);
  });

  it('releases with try_release instead of writing an absolute reserved_quantity', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      try_release_business_inventory: [{ id: 'inv-1' }],
    });

    const result = await releaseReservedInventory(
      { executeMutation },
      [
        { business_inventory_id: 'inv-1', quantity: 2 },
        { business_inventory_id: 'inv-1', quantity: 1 },
      ]
    );

    expect(result).toEqual({ released: 1, skipped: 0 });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(String(executeMutation.mock.calls[0][0])).toContain(
      'try_release_business_inventory'
    );
    expect(executeMutation.mock.calls[0][1]).toEqual({
      inventoryId: 'inv-1',
      qty: 3,
    });
    expect(String(executeMutation.mock.calls[0][0])).not.toContain(
      'reserved_quantity'
    );
  });

  it('counts a no-op release as skipped instead of throwing', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      try_release_business_inventory: [],
    });

    const result = await releaseReservedInventory(
      { executeMutation },
      [{ business_inventory_id: 'inv-1', quantity: 2 }]
    );

    expect(result).toEqual({ released: 0, skipped: 1 });
  });
});
