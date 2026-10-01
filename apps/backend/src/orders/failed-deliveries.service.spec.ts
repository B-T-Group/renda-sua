import { FailedDeliveriesService } from './failed-deliveries.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));


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

describe('FailedDeliveriesService client-fault fee', () => {
  const FEE = 200;
  const clientAccount = (available: number) => ({
    id: 'client-acc',
    available_balance: available,
  });

  function setup(opts: {
    clientAvailable: number;
    order?: Record<string, unknown>;
    hold?: Record<string, unknown>;
    debitResult?: { success: boolean; error?: string };
  }) {
    const mocks = createService();
    const {
      service,
      executeQuery,
      executeMutation,
      getAccount,
      registerTransaction,
    } = mocks;
    const deliveryConfig = { getDeliveryConfig: jest.fn().mockResolvedValue(FEE) };
    (service as any).deliveryConfigService = deliveryConfig;
    executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('GetFailedDelivery(')) {
        return { failed_deliveries: [failedDeliveryRow(opts.order)] };
      }
      return {
        order_holds: [
          {
            id: 'hold-1',
            client_hold_amount: 1000,
            agent_hold_amount: 0,
            delivery_fees: 0,
            currency: 'XAF',
            ...opts.hold,
          },
        ],
      };
    });
    executeMutation.mockResolvedValue({});
    getAccount.mockImplementation(async (userId: string) => {
      if (userId === 'client-user') return clientAccount(opts.clientAvailable);
      if (userId === 'agent-user') return { id: 'agent-acc' };
      return { id: 'biz-acc' };
    });
    registerTransaction.mockImplementation(async (req: any) =>
      req.accountId === 'client-acc' && req.transactionType === 'withdrawal' && opts.debitResult
        ? opts.debitResult
        : { success: true }
    );
    return mocks;
  }

  const anomaly = reportMoneyAnomaly as jest.Mock;
  beforeEach(() => anomaly.mockClear());
  const anomalyMarkers = () => anomaly.mock.calls.map((c) => c[1]);

  const resolve = (service: FailedDeliveriesService) =>
    service.resolveFailedDelivery(
      'order-1',
      { resolution_type: 'client_fault', outcome: 'no show' },
      { userId: 'u1', businessId: 'biz-1' } as never
    );

  const calls = (registerTransaction: jest.Mock, accountId: string, type: string) =>
    registerTransaction.mock.calls
      .map(([r]) => r)
      .filter((r) => r.accountId === accountId && r.transactionType === type);

  it('charges the full fee and splits it 50/50 when the wallet covers it', async () => {
    const { service, registerTransaction } = setup({ clientAvailable: 1000 });
    const result: any = await resolve(service);
    expect(calls(registerTransaction, 'client-acc', 'withdrawal')).toEqual([
      expect.objectContaining({ amount: 200, referenceId: 'order-1' }),
    ]);
    expect(calls(registerTransaction, 'agent-acc', 'deposit')[0].amount).toBe(100);
    expect(calls(registerTransaction, 'biz-acc', 'deposit')[0].amount).toBe(100);
    expect(result.client_fee_shortfall).toBeUndefined();
    expect(anomaly).not.toHaveBeenCalled();
  });

  it('releases the held funds before debiting the fee from the released balance', async () => {
    const { service, registerTransaction } = setup({
      clientAvailable: 1000,
      hold: { client_hold_amount: 300, delivery_fees: 100 },
    });
    await resolve(service);
    const seq = registerTransaction.mock.calls
      .map(([r]) => r)
      .filter((r) => r.accountId === 'client-acc')
      .map((r) => `${r.transactionType}:${r.amount}`);
    expect(seq).toEqual(['release:300', 'release:100', 'withdrawal:200']);
    expect(anomaly).not.toHaveBeenCalled();
  });

  it('credits only what was debited when the wallet cannot cover the fee', async () => {
    const { service, registerTransaction, executeMutation } = setup({
      clientAvailable: 50,
    });
    const result: any = await resolve(service);
    expect(calls(registerTransaction, 'client-acc', 'withdrawal')[0].amount).toBe(50);
    expect(calls(registerTransaction, 'agent-acc', 'deposit')[0].amount).toBe(25);
    expect(calls(registerTransaction, 'biz-acc', 'deposit')[0].amount).toBe(25);
    expect(result.client_fee_shortfall).toBe(150);
    const update = executeMutation.mock.calls.at(-1)?.[1].updates;
    expect(update.status).toBe('completed');
    expect(update.outcome).toContain('shortfall not collected: 150 XAF');
    expect(anomalyMarkers()).toEqual(['failed_delivery_fee_shortfall']);
    expect(anomaly.mock.calls[0][2]).toContain('should be impossible');
  });

  it('credits nobody when the client has no funds', async () => {
    const { service, registerTransaction } = setup({ clientAvailable: 0 });
    const result: any = await resolve(service);
    expect(calls(registerTransaction, 'client-acc', 'withdrawal')).toHaveLength(0);
    expect(calls(registerTransaction, 'agent-acc', 'deposit')).toHaveLength(0);
    expect(calls(registerTransaction, 'biz-acc', 'deposit')).toHaveLength(0);
    expect(result.client_fee_shortfall).toBe(FEE);
    expect(anomalyMarkers()).toContain('failed_delivery_fee_shortfall');
  });

  it('credits nobody when the debit itself is rejected', async () => {
    const { service, registerTransaction } = setup({
      clientAvailable: 1000,
      debitResult: { success: false, error: 'Insufficient funds for this transaction' },
    });
    const result: any = await resolve(service);
    expect(calls(registerTransaction, 'agent-acc', 'deposit')).toHaveLength(0);
    expect(calls(registerTransaction, 'biz-acc', 'deposit')).toHaveLength(0);
    expect(result.client_fee_shortfall).toBe(FEE);
    expect(anomalyMarkers()).toEqual([
      'failed_delivery_fee_debit_failed',
      'failed_delivery_fee_shortfall',
    ]);
  });

  it('reports an anomaly when the fee exceeds the funds held for the order', async () => {
    const { service, registerTransaction } = setup({
      clientAvailable: 1000,
      hold: { client_hold_amount: 0, delivery_fees: 50 },
    });
    const result: any = await resolve(service);
    expect(anomalyMarkers()).toEqual(['failed_delivery_fee_hold_insufficient']);
    // wallet could still cover it, so the fee is collected in full
    expect(calls(registerTransaction, 'client-acc', 'withdrawal')[0].amount).toBe(200);
    expect(result.client_fee_shortfall).toBeUndefined();
  });

  it('reports an anomaly when releasing the hold fails', async () => {
    const { service, registerTransaction } = setup({ clientAvailable: 1000 });
    registerTransaction.mockImplementation(async (req: any) =>
      req.transactionType === 'release'
        ? { success: false, error: 'nope' }
        : { success: true }
    );
    await resolve(service);
    expect(anomalyMarkers()).toEqual(['failed_delivery_hold_release_failed']);
  });

  it('gives the whole collected amount to the business when no agent is assigned', async () => {
    const { service, registerTransaction } = setup({
      clientAvailable: 1000,
      order: { assigned_agent: null },
    });
    await resolve(service);
    expect(calls(registerTransaction, 'agent-acc', 'deposit')).toHaveLength(0);
    expect(calls(registerTransaction, 'biz-acc', 'deposit')[0].amount).toBe(100);
  });

  it('does not lose a cent on odd partial amounts', async () => {
    const { service, registerTransaction } = setup({ clientAvailable: 0.05 });
    await resolve(service);
    const agent = calls(registerTransaction, 'agent-acc', 'deposit')[0].amount;
    const biz = calls(registerTransaction, 'biz-acc', 'deposit')[0].amount;
    expect(Number((agent + biz).toFixed(2))).toBe(0.05);
  });

  it('still releases the client delivery-fee hold before charging', async () => {
    const { service, registerTransaction } = setup({
      clientAvailable: 1000,
      hold: { client_hold_amount: 0, delivery_fees: 500 },
    });
    await resolve(service);
    const types = registerTransaction.mock.calls.map(([r]) => r.transactionType);
    expect(anomaly).not.toHaveBeenCalled();
    expect(types.indexOf('release')).toBeLessThan(types.indexOf('withdrawal'));
  });
});
