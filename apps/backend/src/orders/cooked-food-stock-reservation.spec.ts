jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { FOOD_CATEGORY_NAME } from '../food/food.constants';
import { OrdersService } from './orders.service';

function stockRow(id: string, categoryName?: string | null) {
  return {
    id,
    item: {
      item_sub_category: categoryName
        ? { item_category: { name: categoryName } }
        : null,
    },
  };
}

function createService(rows: ReturnType<typeof stockRow>[]) {
  const executeQuery = jest.fn(async (query: string) => {
    if (query.includes('StockTrackedInventories')) {
      return { business_inventory: rows };
    }
    if (query.includes('UpdateInventoryOnCompletion')) {
      return { update_business_inventory_by_pk: { id: 'ok' } };
    }
    return {};
  });
  const executeMutation = jest.fn(async (mutation: string) => {
    if (mutation.includes('try_reserve_business_inventory')) {
      return { try_reserve_business_inventory: [{ id: 'ok' }] };
    }
    if (mutation.includes('try_release_business_inventory')) {
      return { try_release_business_inventory: [{ id: 'ok' }] };
    }
    return {};
  });
  const service = Object.create(OrdersService.prototype) as OrdersService;
  (service as any).hasuraSystemService = { executeQuery, executeMutation };
  (service as any).logger = {
    warn: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  };
  return { service, executeQuery, executeMutation };
}

describe('OrdersService cooked-food stock sentinel', () => {
  it('reserves and releases only stock-tracked lines in a mixed cart', async () => {
    const { service, executeMutation } = createService([
      stockRow('inv-food', FOOD_CATEGORY_NAME),
      stockRow('inv-retail', 'Retail & Shopping'),
    ]);

    await service.updateReservedQuantities(
      [
        { business_inventory_id: 'inv-food', quantity: 4 },
        { business_inventory_id: 'inv-retail', quantity: 2 },
        { business_inventory_id: 'inv-retail', quantity: 1 },
      ],
      'increment'
    );

    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('try_reserve_business_inventory'),
      { inventoryId: 'inv-retail', qty: 3 }
    );

    executeMutation.mockClear();
    await service.updateReservedQuantities(
      [
        { business_inventory_id: 'inv-food', quantity: 4 },
        { business_inventory_id: 'inv-retail', quantity: 2 },
      ],
      'decrement'
    );

    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('try_release_business_inventory'),
      { inventoryId: 'inv-retail', qty: 2 }
    );
  });

  it('does not decrement cooked-food quantity when an order completes', async () => {
    const { service, executeQuery } = createService([
      stockRow('inv-food', FOOD_CATEGORY_NAME),
      stockRow('inv-retail', null),
    ]);

    await (service as any).updateInventoryOnCompletion([
      { business_inventory_id: 'inv-food', quantity: 6 },
      { business_inventory_id: 'inv-retail', quantity: 2 },
    ]);

    const writes = executeQuery.mock.calls.filter((call) =>
      String(call[0]).includes('UpdateInventoryOnCompletion')
    );
    expect(writes).toEqual([
      [
        expect.stringContaining('UpdateInventoryOnCompletion'),
        { id: 'inv-retail', quantity: -2, reservedQuantity: -2 },
      ],
    ]);
  });

  it('skips inventory writes when every line is cooked food', async () => {
    const { service, executeMutation } = createService([
      stockRow('inv-food', ` ${FOOD_CATEGORY_NAME} `),
    ]);

    await service.updateReservedQuantities(
      [{ business_inventory_id: 'inv-food', quantity: 9 }],
      'increment'
    );

    expect(executeMutation).not.toHaveBeenCalled();
  });
});
