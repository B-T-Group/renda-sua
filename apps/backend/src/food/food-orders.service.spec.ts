import { FoodOrdersService } from './food-orders.service';
import { FOOD_CATEGORY_NAME } from './food.constants';

const FOOD_LINE = {
  id: 'line-1',
  business_inventory_id: 'inv-1',
  business_inventory: {
    id: 'inv-1',
    item_id: 'item-1',
    business_location_id: 'loc-1',
    quantity: 10,
    reserved_quantity: 2,
    item: {
      item_sub_category: {
        item_category: { name: FOOD_CATEGORY_NAME },
      },
    },
  },
};

describe('FoodOrdersService.applyConfirmationUpdates', () => {
  function createService(overrides?: {
    executeQuery?: jest.Mock;
    executeMutation?: jest.Mock;
  }) {
    const executeQuery =
      overrides?.executeQuery ??
      jest.fn().mockResolvedValue({ order_items: [FOOD_LINE] });
    const executeMutation =
      overrides?.executeMutation ?? jest.fn().mockResolvedValue({ id: 'ok' });
    const service = new FoodOrdersService({
      executeQuery,
      executeMutation,
    } as any);
    return { service, executeQuery, executeMutation };
  }

  it('does nothing when the merchant sent no corrections', async () => {
    const { service, executeQuery, executeMutation } = createService();

    await service.applyConfirmationUpdates('order-1', []);

    expect(executeQuery).not.toHaveBeenCalled();
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('sets remaining quantity and does not swallow Hasura errors', async () => {
    const { service, executeMutation } = createService({
      executeMutation: jest
        .fn()
        .mockRejectedValue(new Error('Hasura write failed')),
    });

    await expect(
      service.applyConfirmationUpdates('order-1', [
        { order_item_id: 'line-1', remaining_quantity: 4 },
      ])
    ).rejects.toThrow('Hasura write failed');
    expect(executeMutation).toHaveBeenCalled();
  });

  it('marks the dish sold out and surfaces a failed upsert', async () => {
    const { service, executeMutation } = createService({
      executeMutation: jest
        .fn()
        .mockRejectedValue(new Error('sold-out upsert failed')),
    });

    await expect(
      service.applyConfirmationUpdates('order-1', [
        { order_item_id: 'line-1', last_one: true },
      ])
    ).rejects.toThrow('sold-out upsert failed');
    expect(executeMutation).toHaveBeenCalled();
  });

  it('writes remaining quantity when Hasura accepts the mutation', async () => {
    const { service, executeMutation } = createService();

    await service.applyConfirmationUpdates('order-1', [
      { order_item_id: 'line-1', remaining_quantity: 4 },
    ]);

    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetFoodInventoryQuantity'),
      { inventoryId: 'inv-1', quantity: 6 }
    );
  });

  it('skips grocery lines so confirmation stock only touches cooked food', async () => {
    const groceryLine = {
      ...FOOD_LINE,
      id: 'line-grocery',
      business_inventory: {
        ...FOOD_LINE.business_inventory,
        item: {
          item_sub_category: {
            item_category: { name: 'Food & Beverages' },
          },
        },
      },
    };
    const { service, executeMutation } = createService({
      executeQuery: jest.fn().mockResolvedValue({ order_items: [groceryLine] }),
    });

    await service.applyConfirmationUpdates('order-1', [
      { order_item_id: 'line-grocery', remaining_quantity: 1, last_one: true },
    ]);

    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('marks the last portion sold out when Hasura accepts the upsert', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const { service, executeMutation } = createService();

    await service.applyConfirmationUpdates('order-1', [
      { order_item_id: 'line-1', last_one: true },
    ]);

    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpsertFoodSoldOutFlag'),
      {
        itemId: 'item-1',
        locationId: 'loc-1',
        markedAt: '2026-08-24T12:00:00.000Z',
      }
    );
    jest.useRealTimers();
  });
});

describe('FoodOrdersService.containsCookedFood', () => {
  it('returns true when any line is a cooked dish', async () => {
    const service = new FoodOrdersService({
      executeQuery: jest.fn().mockResolvedValue({ order_items: [FOOD_LINE] }),
      executeMutation: jest.fn(),
    } as any);

    await expect(service.containsCookedFood('order-1')).resolves.toBe(true);
  });

  it('fails open to false when Hasura cannot load the order lines', async () => {
    const service = new FoodOrdersService({
      executeQuery: jest.fn().mockRejectedValue(new Error('Hasura down')),
      executeMutation: jest.fn(),
    } as any);

    await expect(service.containsCookedFood('order-1')).resolves.toBe(false);
  });
});
