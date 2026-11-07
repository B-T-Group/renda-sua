jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
import { OrderReassignmentService } from './order-reassignment.service';

describe('OrderReassignmentService hold release safety', () => {
  function buildService(opts?: {
    releaseSuccess?: boolean;
    holdStatus?: 'active' | 'cancelled';
    holdAmount?: number;
    dropAffected?: number;
    reassignmentCount?: number;
    clearError?: unknown;
  }) {
    const releaseSuccess = opts?.releaseSuccess ?? true;
    const holdStatus = opts?.holdStatus ?? 'active';
    const holdAmount = opts?.holdAmount ?? 50;
    const dropAffected = opts?.dropAffected ?? 1;

    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('ReassignOrder')) {
        return {
          orders_by_pk: {
            id: 'order-1',
            order_number: 'ORD-1',
            current_status: 'assigned_to_agent',
            assigned_agent_id: 'agent-1',
            currency: 'XAF',
            reassignment_count: opts?.reassignmentCount ?? 0,
            assigned_agent: { id: 'agent-1', user_id: 'agent-user-1', user: {} },
            business: { user_id: 'biz-user-1', user: {} },
            client: { user_id: 'client-user-1', user: {} },
          },
        };
      }
      if (query.includes('AgentHoldLedger')) {
        return { holds: [{ amount: holdAmount }], releases: [] };
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

    const executeMutation = jest.fn(async (mutation: string, vars: any = {}) => {
      if (mutation.includes('ReleaseAgentOrderHold')) {
        if (!releaseSuccess) throw new Error('agent_hold_release_withheld_short');
        return { release_agent_order_hold: [{ id: 'tx-1', amount: vars.cap ?? holdAmount }] };
      }
      if (mutation.includes('SystemDropOrder')) {
        return { update_orders: { affected_rows: dropAffected } };
      }
      if (mutation.includes('ClearDesignatedStamps')) {
        if (opts?.clearError !== undefined) throw opts.clearError;
        return { update_orders_by_pk: { id: 'order-1' } };
      }
      if (mutation.includes('CancelHold')) {
        return { update_order_holds: { affected_rows: 1 } };
      }
      if (mutation.includes('RevertSystemDrop')) {
        return { update_orders: { affected_rows: 1 } };
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
      registerReleaseIfNotExists: jest.fn(),
      registerTransaction: jest.fn().mockResolvedValue({
        success: releaseSuccess,
        error: releaseSuccess ? undefined : 'Insufficient funds',
      }),
    } as any;

    const orderEvents = { recordEvent: jest.fn().mockResolvedValue(undefined) } as any;
    const notifications = {
      sendPickupReassignedAgentPush: jest.fn().mockResolvedValue(undefined),
      sendPickupReassignedBusinessPush: jest.fn().mockResolvedValue(undefined),
      sendPickupReassignedCustomerPush: jest.fn().mockResolvedValue(undefined),
      sendPickupReassignmentEscalationPush: jest.fn().mockResolvedValue(undefined),
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

    return { service, executeMutation, accountsService, hasura, orderOffers };
  }

  it('releases hold idempotently and cancels only after success', async () => {
    const { service, executeMutation, accountsService } = buildService();

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result.success).toBe(true);
    // #622: the net hold, released in one SQL function (key derived under its lock).
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('release_agent_order_hold('),
      expect.objectContaining({ accountId: 'acct-1', orderId: 'order-1', cap: null })
    );
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
    expect(
      executeMutation.mock.calls.some((c) => String(c[0]).includes('CancelHold'))
    ).toBe(true);
  });

  it('rolls back reassignment when ledger release fails', async () => {
    const { service, executeMutation, accountsService } = buildService({
      releaseSuccess: false,
    });

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result.success).toBe(false);
    expect(executeMutation.mock.calls.some((c) => String(c[0]).includes('ReleaseAgentOrderHold'))).toBe(true);
    expect(
      executeMutation.mock.calls.some((c) => String(c[0]).includes('CancelHold'))
    ).toBe(false);
    expect(
      executeMutation.mock.calls.some((c) =>
        String(c[0]).includes('RevertSystemDrop')
      )
    ).toBe(true);
  });

  it('clears leftover designated stamps after a successful drop so the next agent does not inherit the cutoff', async () => {
    const { service, executeMutation } = buildService();

    const result = await service.reassignOrder('order-1', 'agent_issue:emergency');

    expect(result.success).toBe(true);
    const clear = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('ClearDesignatedStamps')
    );
    expect(clear?.[1]).toEqual({ id: 'order-1' });
    const mutation = String(clear?.[0]);
    expect(mutation).toContain('designated_accepted_at: null');
    expect(mutation).toContain('designated_release_cutoff_at: null');
    expect(mutation).toContain('designated_confirmed_at: null');
    expect(mutation).toContain('designated_unconfirmed_flagged_at: null');
    expect(mutation).toContain('assignment_source: null');
  });

  it('does not clear stamps when the unassign loses the compare-and-swap', async () => {
    const { service, executeMutation } = buildService({ dropAffected: 0 });

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result).toEqual({
      success: false,
      message: 'Could not unassign agent',
    });
    expect(
      executeMutation.mock.calls.some((c) =>
        String(c[0]).includes('ClearDesignatedStamps')
      )
    ).toBe(false);
    expect(
      executeMutation.mock.calls.some((c) =>
        String(c[0]).includes('ReleaseAgentOrderHold')
      )
    ).toBe(false);
  });

  it('still clears stamps on a strike-out drop, which does not redispatch', async () => {
    const { service, executeMutation, orderOffers } = buildService({
      reassignmentCount: 2,
    });

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result.success).toBe(true);
    expect(result.message).toContain('escalated');
    expect(
      executeMutation.mock.calls.some(
        (c) =>
          String(c[0]).includes('ClearDesignatedStamps') &&
          c[1]?.id === 'order-1'
      )
    ).toBe(true);
    expect(orderOffers.runDispatchRound).not.toHaveBeenCalled();
  });

  it('a failed stamp clear does not undo a drop that already released the agent', async () => {
    const { service, executeMutation } = buildService({
      clearError: new Error('hasura down'),
    });
    const warn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result.success).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Designated stamps not cleared after drop of order-1: hasura down')
    );
    expect(
      executeMutation.mock.calls.some((c) => String(c[0]).includes('Hist'))
    ).toBe(true);
    warn.mockRestore();
  });

  it('keeps designated stamps when the drop is reverted after a hold-release failure', async () => {
    const { service, executeMutation } = buildService({
      releaseSuccess: false,
    });

    const result = await service.reassignOrder('order-1', 'pickup_sla');

    expect(result.success).toBe(false);
    expect(
      executeMutation.mock.calls.some((c) =>
        String(c[0]).includes('ClearDesignatedStamps')
      )
    ).toBe(false);
  });

  it('skips ledger work when hold is not active', async () => {
    const { service, accountsService, executeMutation } = buildService({
      holdStatus: 'cancelled',
    });

    await service.reassignOrder('order-1', 'pickup_sla');

    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(
      executeMutation.mock.calls.some((c) => String(c[0]).includes('CancelHold'))
    ).toBe(false);
  });
});
