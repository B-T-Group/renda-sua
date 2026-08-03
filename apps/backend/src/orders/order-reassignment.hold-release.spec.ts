import { OrderReassignmentService } from './order-reassignment.service';

describe('OrderReassignmentService hold release safety', () => {
  function buildService(opts?: {
    releaseSuccess?: boolean;
    holdStatus?: 'active' | 'cancelled';
    holdAmount?: number;
  }) {
    const releaseSuccess = opts?.releaseSuccess ?? true;
    const holdStatus = opts?.holdStatus ?? 'active';
    const holdAmount = opts?.holdAmount ?? 50;

    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('ReassignOrder')) {
        return {
          orders_by_pk: {
            id: 'order-1',
            order_number: 'ORD-1',
            current_status: 'assigned_to_agent',
            assigned_agent_id: 'agent-1',
            currency: 'XAF',
            reassignment_count: 0,
            assigned_agent: { id: 'agent-1', user_id: 'agent-user-1', user: {} },
            business: { user_id: 'biz-user-1', user: {} },
            client: { user_id: 'client-user-1', user: {} },
          },
        };
      }
      if (query.includes('OrderHold')) {
        return {
          order_holds:
            holdStatus === 'active'
              ? [{ id: 'hold-1', agent_hold_amount: holdAmount, status: 'active' }]
              : [],
        };
      }
      return {};
    });

    const executeMutation = jest.fn(async (mutation: string) => {
      if (mutation.includes('SystemDropOrder')) {
        return { update_orders: { affected_rows: 1 } };
      }
      if (mutation.includes('CancelHold')) {
        return { update_order_holds: { affected_rows: 1 } };
      }
      if (mutation.includes('Hist')) {
        return { insert_order_status_history: { affected_rows: 1 } };
      }
      return {};
    });

    const hasura = {
      executeQuery,
      executeMutation,
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-1' }),
    } as any;

    const accountsService = {
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({
        success: releaseSuccess,
        error: releaseSuccess ? undefined : 'Insufficient funds',
      }),
      registerTransaction: jest.fn(),
    } as any;

    const orderEvents = { recordEvent: jest.fn().mockResolvedValue(undefined) } as any;
    const notifications = {
      sendPickupReassignedAgentPush: jest.fn().mockResolvedValue(undefined),
      sendPickupReassignedBusinessPush: jest.fn().mockResolvedValue(undefined),
      sendPickupReassignedCustomerPush: jest.fn().mockResolvedValue(undefined),
    } as any;
    const orderOffers = {
      runDispatchRound: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new OrderReassignmentService(
      hasura,
      orderEvents,
      notifications,
      orderOffers,
      accountsService
    );

    return { service, executeMutation, accountsService, hasura };
  }

  it('releases hold idempotently and cancels only after success', async () => {
    const { service, executeMutation, accountsService } = buildService();

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result.success).toBe(true);
    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-1',
        amount: 50,
        referenceId: 'order-1',
      })
    );
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(
      executeMutation.mock.calls.some((c) => String(c[0]).includes('CancelHold'))
    ).toBe(true);
  });

  it('does not cancel hold row when ledger release fails', async () => {
    const { service, executeMutation, accountsService } = buildService({
      releaseSuccess: false,
    });

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result.success).toBe(true);
    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalled();
    expect(
      executeMutation.mock.calls.some((c) => String(c[0]).includes('CancelHold'))
    ).toBe(false);
  });

  it('skips ledger work when hold is not active', async () => {
    const { service, accountsService, executeMutation } = buildService({
      holdStatus: 'cancelled',
    });

    await service.reassignOrder('order-1', 'pickup_sla');

    expect(accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
    expect(
      executeMutation.mock.calls.some((c) => String(c[0]).includes('CancelHold'))
    ).toBe(false);
  });
});
