/**
 * #608 follow-up: an agent hold stranded by a failed release whose revert lost the
 * order to another agent. Alert (money-anomaly path) + `agent_hold_stranded` event at
 * failure time; reconcileStrandedAgentHolds releases it once, idempotently.
 */
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../common/utils/money-alert.util', () => ({ reportMoneyAnomaly: jest.fn() }));
import { Logger } from '@nestjs/common';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { OrderReassignmentService, STRANDED_HOLD_MARKER } from './order-reassignment.service';

type Ev = { id: string; order_id: string; event_type: string; payload: Record<string, unknown>; created_at: string };

function world(opts: { revertWins?: boolean; releaseOk?: boolean } = {}) {
  const events: Ev[] = [];
  const ledger: Array<{ accountId: string; referenceId: string; amount: number }> = [];
  const order = {
    id: 'order-1',
    order_number: 'ORD-1',
    current_status: 'assigned_to_agent',
    assigned_agent_id: 'agent-1' as string | null,
    currency: 'XAF',
    reassignment_count: 0,
    assigned_agent: { id: 'agent-1', user_id: 'agent-user-1', user: {} },
    business: { user_id: 'biz-user-1', user: {} },
    client: { user_id: 'client-user-1', user: {} },
  };
  const executeQuery = jest.fn(async (query: string, vars: Record<string, any>) => {
    if (query.includes('query ReassignOrder')) return { orders_by_pk: { ...order } };
    if (query.includes('query OrderHold')) return { order_holds: [{ id: 'hold-1', agent_hold_amount: 700, status: 'active' }] };
    if (query.includes('query StrandedAgentHoldsResolved')) {
      return { order_events: events.filter((e) => e.event_type === 'agent_hold_stranded_released' && vars.orderIds.includes(e.order_id)) };
    }
    if (query.includes('query StrandedAgentHolds')) {
      return {
        order_events: events
          .filter((e) => e.event_type === 'agent_hold_stranded' && e.created_at >= vars.since)
          .slice(0, vars.limit),
      };
    }
    if (query.includes('query StrandedHoldOrder')) return { orders_by_pk: { id: order.id, order_number: order.order_number, assigned_agent_id: state.current } };
    return {};
  });
  const state = { current: 'agent-2' as string | null };
  const executeMutation = jest.fn(async (mutation: string) => {
    if (mutation.includes('SystemDropOrder')) return { update_orders: { affected_rows: 1 } };
    if (mutation.includes('RevertSystemDrop')) return { update_orders: { affected_rows: opts.revertWins === false ? 0 : 1 } };
    return {};
  });
  const accounts = {
    registerReleaseIfNotExists: jest.fn(async (r: { accountId: string; referenceId: string; amount: number }) => {
      if (opts.releaseOk === false) return { success: false, error: 'ledger down' };
      if (ledger.some((l) => l.accountId === r.accountId && l.referenceId === r.referenceId)) return { success: true, alreadyExists: true };
      ledger.push(r);
      return { success: true, alreadyExists: false };
    }),
    registerTransaction: jest.fn(),
  };
  let seq = 0;
  const orderEvents = {
    recordEvent: jest.fn(async (p: { orderId: string; eventType: string; payload?: Record<string, unknown> }) => {
      events.push({ id: `ev-${++seq}`, order_id: p.orderId, event_type: p.eventType, payload: p.payload ?? {}, created_at: new Date().toISOString() });
    }),
  };
  const service = new OrderReassignmentService(
    { executeQuery, executeMutation, getAccount: jest.fn(async (userId: string) => ({ id: `acct-${userId}` })) } as any,
    orderEvents as any,
    { sendPickupReassignedAgentPush: jest.fn(), sendPickupReassignedBusinessPush: jest.fn(), sendPickupReassignedCustomerPush: jest.fn() } as any,
    { runDispatchRound: jest.fn() } as any,
    accounts as any
  );
  return { service, events, ledger, accounts, state, orderEvents };
}

const stranded = (w: ReturnType<typeof world>) => w.events.filter((e) => e.event_type === 'agent_hold_stranded');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('#608 follow-up: stranded agent hold on the pickup reassignment path', () => {
  it('release fails and the revert loses the order -> one money-anomaly alert and an agent_hold_stranded event', async () => {
    const w = world({ revertWins: false });
    w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' } as any);
    const res = await w.service.reassignOrder('order-1', 'pickup_sla');
    expect(res.success).toBe(false);
    expect(reportMoneyAnomaly).toHaveBeenCalledTimes(1);
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.any(Logger),
      STRANDED_HOLD_MARKER,
      expect.stringContaining('ORD-1'),
      expect.objectContaining({ orderId: 'order-1', holdId: 'hold-1', agentId: 'agent-1', agentUserId: 'agent-user-1', amount: 700, currency: 'XAF', path: 'pickup_reassignment' })
    );
    expect(STRANDED_HOLD_MARKER).toBe('agent_hold_stranded');
    expect(stranded(w)).toEqual([
      expect.objectContaining({ order_id: 'order-1', payload: expect.objectContaining({ agentId: 'agent-1', agentUserId: 'agent-user-1', amount: 700, currency: 'XAF' }) }),
    ]);
  });

  it('release fails but the revert gives the order back -> nothing stranded, no alert', async () => {
    const w = world({ revertWins: true });
    w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' } as any);
    await w.service.reassignOrder('order-1', 'pickup_sla');
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
    expect(stranded(w)).toEqual([]);
  });
});

describe('#608 follow-up: reconcileStrandedAgentHolds', () => {
  const seedStranded = async (w: ReturnType<typeof world>) => {
    w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' } as any);
    await w.service.reassignOrder('order-1', 'pickup_sla');
    expect(stranded(w)).toHaveLength(1);
  };

  it('releases the first agent\'s hold once (their account, the stranded amount, keyed on the order) and records the resolution', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({ released: 1, skipped: 0, failed: 0 });
    expect(w.ledger).toEqual([expect.objectContaining({ accountId: 'acct-agent-user-1', referenceId: 'order-1', amount: 700 })]);
    const resolved = w.events.filter((e) => e.event_type === 'agent_hold_stranded_released');
    expect(resolved).toEqual([expect.objectContaining({ payload: expect.objectContaining({ strandedEventId: stranded(w)[0].id, amount: 700 }) })]);

    // Idempotent: a second run does nothing.
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({ released: 0, skipped: 0, failed: 0 });
    expect(w.ledger).toHaveLength(1);
    expect(w.accounts.registerReleaseIfNotExists).toHaveBeenCalledTimes(2); // the failed one + the reconcile
  });

  it('a release already in the ledger (e.g. a racing run) is not credited twice; the event is still resolved', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    w.ledger.push({ accountId: 'acct-agent-user-1', referenceId: 'order-1', amount: 700 });
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({ released: 1, skipped: 0, failed: 0 });
    expect(w.ledger).toHaveLength(1);
    expect(w.events.filter((e) => e.event_type === 'agent_hold_stranded_released')[0].payload).toMatchObject({ alreadyExisted: true });
  });

  it('skipped while the same agent holds the order again (its hold is live)', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    w.state.current = 'agent-1';
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({ released: 0, skipped: 1, failed: 0 });
    expect(w.ledger).toEqual([]);
  });

  it('a failed release is counted, not resolved, and retried on the next run', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    w.accounts.registerReleaseIfNotExists.mockResolvedValueOnce({ success: false, error: 'ledger down' } as any);
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({ released: 0, skipped: 0, failed: 1 });
    expect(w.events.filter((e) => e.event_type === 'agent_hold_stranded_released')).toEqual([]);
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({ released: 1, skipped: 0, failed: 0 });
    expect(w.ledger).toHaveLength(1);
  });

  it('no stranded events: one query, nothing else', async () => {
    const w = world();
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({ released: 0, skipped: 0, failed: 0 });
    expect(w.accounts.registerReleaseIfNotExists).not.toHaveBeenCalled();
  });
});
