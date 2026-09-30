import { FailedDeliveriesService } from './failed-deliveries.service';

function createService() {
  const getUser = jest.fn();
  const executeQuery = jest.fn();
  const executeMutation = jest.fn();
  const getAccount = jest.fn();
  const registerTransaction = jest.fn().mockResolvedValue({ success: true });
  const updateReservedQuantities = jest.fn().mockResolvedValue(undefined);
  const service = new FailedDeliveriesService(
    { getUser } as never,
    { executeQuery, executeMutation, getAccount } as never,
    { registerTransaction } as never,
    { updateReservedQuantities } as never,
    {} as never
  );
  return {
    service,
    executeQuery,
    executeMutation,
    getAccount,
    registerTransaction,
    updateReservedQuantities,
  };
}

const packLine = {
  id: 'oi-1',
  business_inventory_id: 'inv-1',
  item_variant_id: 'var-pack',
  quantity: 1,
  variant_snapshot: { quantity: 12 },
};

function failedDeliveryRow(overrides?: Record<string, unknown>) {
  return {
    id: 'fd-1',
    status: 'pending',
    order: {
      id: 'order-1',
      order_number: 'RS-1',
      currency: 'XAF',
      business_id: 'biz-1',
      business_location_id: 'loc-1',
      client: { user: { id: 'client-user' } },
      assigned_agent: { user: { id: 'agent-user' } },
      business: { user_id: 'biz-user' },
      order_items: [packLine],
      ...overrides,
    },
  };
}

describe('FailedDeliveriesService item-fault restore', () => {
  it('loads pack snapshot fields used to release reserved stock', async () => {
    const { service, executeQuery } = createService();
    executeQuery.mockResolvedValue({
      failed_deliveries: [failedDeliveryRow()],
    });

    await service.getFailedDelivery('order-1', { skipAuth: true });

    const query = String(executeQuery.mock.calls[0][0]);
    expect(query).toContain('variant_snapshot');
    expect(query).toContain('item_variant_id');
    expect(query).toContain('business_inventory_id');
  });

  it('releases reserved base units instead of reserving again', async () => {
    const {
      service,
      executeQuery,
      executeMutation,
      getAccount,
      updateReservedQuantities,
    } = createService();
    executeQuery
      .mockResolvedValueOnce({ failed_deliveries: [failedDeliveryRow()] })
      .mockResolvedValueOnce({
        order_holds: [
          {
            id: 'hold-1',
            client_hold_amount: 0,
            agent_hold_amount: 0,
            delivery_fees: 0,
          },
        ],
      });
    executeMutation.mockResolvedValue({
      update_failed_deliveries_by_pk: { id: 'fd-1' },
    });
    getAccount.mockResolvedValue({ id: 'acct-1' });

    await service.resolveFailedDelivery(
      'order-1',
      {
        resolution_type: 'item_fault',
        outcome: 'Item returned to shelf',
        restore_inventory: true,
      },
      { userId: 'biz-user', businessId: 'biz-1', locationId: 'loc-1' }
    );

    expect(updateReservedQuantities).toHaveBeenCalledWith(
      [packLine],
      'decrement'
    );
    expect(updateReservedQuantities).not.toHaveBeenCalledWith(
      expect.anything(),
      'increment'
    );
  });

  it('leaves reserved stock untouched when restore is declined', async () => {
    const { service, executeQuery, executeMutation, updateReservedQuantities } =
      createService();
    executeQuery
      .mockResolvedValueOnce({ failed_deliveries: [failedDeliveryRow()] })
      .mockResolvedValueOnce({
        order_holds: [
          {
            id: 'hold-1',
            client_hold_amount: 0,
            agent_hold_amount: 0,
            delivery_fees: 0,
          },
        ],
      });
    executeMutation.mockResolvedValue({
      update_failed_deliveries_by_pk: { id: 'fd-1' },
    });

    await service.resolveFailedDelivery(
      'order-1',
      {
        resolution_type: 'item_fault',
        outcome: 'Item discarded',
        restore_inventory: false,
      },
      { userId: 'biz-user', businessId: 'biz-1', locationId: 'loc-1' }
    );

    expect(updateReservedQuantities).not.toHaveBeenCalled();
  });
});
