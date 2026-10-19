/**
 * #608 follow-up: an agent hold stranded by a failed release whose revert lost the
 * order to another agent. Alert (money-anomaly path) + `agent_hold_stranded` event at
 * failure time; reconcileStrandedAgentHolds releases it once, idempotently.
 */
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));
import { Logger } from '@nestjs/common';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import {
  OrderReassignmentService,
  STRANDED_HOLD_MARKER,
} from './order-reassignment.service';

type Ev = {
  id: string;
  order_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function world(opts: { revertWins?: boolean; releaseOk?: boolean } = {}) {
  const events: Ev[] = [];
  // Agent account ledger for the order: the claim's hold, releases with their keys.
  const ledger: Array<{
    accountId: string;
    referenceId: string;
    amount: number;
    type: 'hold' | 'release';
    key?: string;
  }> = [
    {
      accountId: 'acct-agent-user-1',
      referenceId: 'order-1',
      amount: 700,
      type: 'hold',
    },
  ];
  const releases = () => ledger.filter((l) => l.type === 'release');
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
  const executeQuery = jest.fn(
    async (query: string, vars: Record<string, any>) => {
      if (query.includes('query ReassignOrder'))
        return { orders_by_pk: { ...order } };
      if (query.includes('query AgentHoldLedger')) {
        const rows = ledger.filter(
          (l) =>
            l.accountId === vars.accountId && l.referenceId === vars.orderId
        );
        return {
          holds: rows
            .filter((l) => l.type === 'hold')
            .map((l) => ({ amount: l.amount })),
          releases: rows
            .filter((l) => l.type === 'release')
            .map((l) => ({ amount: l.amount })),
        };
      }
      if (query.includes('query OrderHold'))
        return {
          order_holds: [
            { id: 'hold-1', agent_hold_amount: 700, status: 'active' },
          ],
        };
      // Mirrors the Hasura filters: unresolved (no payload.resolvedAt), oldest first.
      if (query.includes('query AgedOutStrandedAgentHolds')) {
        return {
          order_events: events
            .filter(
              (e) =>
                e.event_type === 'agent_hold_stranded' &&
                e.created_at < vars.since &&
                !('resolvedAt' in e.payload) &&
                !('agedOutAlertedAt' in e.payload)
            )
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .slice(0, 50),
        };
      }
      if (query.includes('query StrandedAgentHolds')) {
        return {
          order_events: events
            .filter(
              (e) =>
                e.event_type === 'agent_hold_stranded' &&
                e.created_at >= vars.since &&
                !('resolvedAt' in e.payload)
            )
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .slice(0, vars.limit),
        };
      }
      if (query.includes('query StrandedHoldOrder'))
        return {
          orders_by_pk: {
            id: order.id,
            order_number: order.order_number,
            assigned_agent_id: state.current,
          },
        };
      return {};
    }
  );
  const state = { current: 'agent-2' as string | null };
  const executeMutation = jest.fn(
    async (mutation: string, vars: Record<string, any> = {}) => {
      if (mutation.includes('ReleaseAgentOrderHold')) {
        // Mirrors release_agent_order_hold: net under the (here implicit) lock, min(net,
        // cap), the given key or a state-derived one; the ledger write itself goes
        // through accounts.registerTransaction so tests can make it fail.
        const rows = ledger.filter((l) => l.accountId === vars.accountId && l.referenceId === vars.orderId);
        const holds = rows.filter((l) => l.type === 'hold');
        const rels = rows.filter((l) => l.type === 'release');
        const net = holds.reduce((t, l) => t + l.amount, 0) - rels.reduce((t, l) => t + l.amount, 0);
        const key = vars.key ?? `agent-hold-release:${vars.orderId}:${vars.accountId}:h${holds.length}:r${rels.length}`;
        if (ledger.some((l) => l.key === key)) return { release_agent_order_hold: [] };
        const amount = Math.min(net, vars.cap ?? net);
        if (!(amount > 0)) return { release_agent_order_hold: [] };
        const r = await accounts.registerTransaction({ accountId: vars.accountId, referenceId: vars.orderId, amount, transactionType: 'release', idempotencyKey: key });
        if (!r.success) throw new Error(r.error || 'release failed');
        if ((r as any).alreadyExists) return { release_agent_order_hold: [] };
        return { release_agent_order_hold: [{ id: `tx-${ledger.length}`, amount }] };
      }
      if (mutation.includes('MarkStrandedAgentHold')) {
        const e = events.find((x) => x.id === vars.id);
        if (e) e.payload = { ...e.payload, ...vars.patch };
        return { update_order_events: { affected_rows: e ? 1 : 0 } };
      }
      if (mutation.includes('SystemDropOrder'))
        return { update_orders: { affected_rows: 1 } };
      if (mutation.includes('RevertSystemDrop'))
        return {
          update_orders: { affected_rows: opts.revertWins === false ? 0 : 1 },
        };
      return {};
    }
  );
  const accounts = {
    registerReleaseIfNotExists: jest.fn(),
    // Mirrors AccountsService: the UNIQUE idempotency key makes a repeat a no-op.
    registerTransaction: jest.fn(
      async (r: {
        accountId: string;
        referenceId: string;
        amount: number;
        transactionType: 'release';
        idempotencyKey?: string;
      }) => {
        if (opts.releaseOk === false)
          return { success: false, error: 'ledger down' };
        if (r.idempotencyKey && ledger.some((l) => l.key === r.idempotencyKey))
          return { success: true, alreadyExists: true };
        ledger.push({
          accountId: r.accountId,
          referenceId: r.referenceId,
          amount: r.amount,
          type: r.transactionType,
          key: r.idempotencyKey,
        });
        return { success: true };
      }
    ),
  };
  let seq = 0;
  const push = async (p: {
    orderId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }) => {
    events.push({
      id: `ev-${++seq}`,
      order_id: p.orderId,
      event_type: p.eventType,
      payload: { ...(p.payload ?? {}) },
      created_at: new Date().toISOString(),
    });
  };
  const orderEvents = {
    recordEvent: jest.fn(push),
    recordEventStrict: jest.fn(push),
  };
  const service = new OrderReassignmentService(
    {
      executeQuery,
      executeMutation,
      getAccount: jest.fn(async (userId: string) => ({ id: `acct-${userId}` })),
    } as any,
    orderEvents as any,
    {
      sendPickupReassignedAgentPush: jest.fn(),
      sendPickupReassignedBusinessPush: jest.fn(),
      sendPickupReassignedCustomerPush: jest.fn(),
    } as any,
    { runDispatchRound: jest.fn() } as any,
    accounts as any
  );
  return { service, events, ledger, releases, accounts, state, orderEvents, executeMutation };
}

const stranded = (w: ReturnType<typeof world>) =>
  w.events.filter((e) => e.event_type === 'agent_hold_stranded');

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
    w.accounts.registerTransaction.mockResolvedValueOnce({
      success: false,
      error: 'ledger down',
    } as any);
    const res = await w.service.reassignOrder('order-1', 'pickup_sla');
    expect(res.success).toBe(false);
    expect(reportMoneyAnomaly).toHaveBeenCalledTimes(1);
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.any(Logger),
      STRANDED_HOLD_MARKER,
      expect.stringContaining('ORD-1'),
      expect.objectContaining({
        orderId: 'order-1',
        holdId: 'hold-1',
        agentId: 'agent-1',
        agentUserId: 'agent-user-1',
        amount: 700,
        currency: 'XAF',
        path: 'pickup_reassignment',
      })
    );
    expect(STRANDED_HOLD_MARKER).toBe('agent_hold_stranded');
    expect(stranded(w)).toEqual([
      expect.objectContaining({
        order_id: 'order-1',
        payload: expect.objectContaining({
          agentId: 'agent-1',
          agentUserId: 'agent-user-1',
          amount: 700,
          currency: 'XAF',
        }),
      }),
    ]);
  });

  it('release fails but the revert gives the order back -> nothing stranded, no alert', async () => {
    const w = world({ revertWins: true });
    w.accounts.registerTransaction.mockResolvedValueOnce({
      success: false,
      error: 'ledger down',
    } as any);
    await w.service.reassignOrder('order-1', 'pickup_sla');
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
    expect(stranded(w)).toEqual([]);
  });

  it('QA #622 F4: the stranded event write throwing does not break the reassignment; it alerts instead', async () => {
    const w = world({ revertWins: false });
    w.accounts.registerTransaction.mockResolvedValueOnce({
      success: false,
      error: 'ledger down',
    } as any);
    w.orderEvents.recordEventStrict.mockRejectedValueOnce(
      new Error('hasura down')
    );
    await expect(
      w.service.reassignOrder('order-1', 'pickup_sla')
    ).resolves.toMatchObject({ success: false });
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.any(Logger),
      'agent_hold_stranded_event_failed',
      expect.stringContaining('hasura down'),
      expect.objectContaining({ orderId: 'order-1' })
    );
  });
});

describe('#608 follow-up: reconcileStrandedAgentHolds', () => {
  const seedStranded = async (w: ReturnType<typeof world>) => {
    w.accounts.registerTransaction.mockResolvedValueOnce({
      success: false,
      error: 'ledger down',
    } as any);
    await w.service.reassignOrder('order-1', 'pickup_sla');
    expect(stranded(w)).toHaveLength(1);
  };

  it("releases the first agent's hold once (their account, the stranded amount, keyed on the strand) and records the resolution", async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(w.releases()).toEqual([
      expect.objectContaining({
        accountId: 'acct-agent-user-1',
        referenceId: 'order-1',
        amount: 700,
        key: `stranded:release:${stranded(w)[0].id}`,
      }),
    ]);
    const resolved = w.events.filter(
      (e) => e.event_type === 'agent_hold_stranded_released'
    );
    expect(resolved).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          strandedEventId: stranded(w)[0].id,
          amount: 700,
          released: 700,
          net: 0,
        }),
      }),
    ]);
    expect(stranded(w)[0].payload).toMatchObject({
      resolvedAt: expect.any(String),
      released: 700,
    });

    // Idempotent: a second run does nothing.
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 0,
      skipped: 0,
      failed: 0,
    });
    expect(w.releases()).toHaveLength(1);
    expect(w.accounts.registerTransaction).toHaveBeenCalledTimes(2); // the failed one + the reconcile
  });

  it('#622: a zero net (already released some other way) credits nothing; the event is still resolved', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    w.ledger.push({
      accountId: 'acct-agent-user-1',
      referenceId: 'order-1',
      amount: 700,
      type: 'release',
      key: 'other',
    });
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(w.releases()).toHaveLength(1);
    expect(
      w.events.filter((e) => e.event_type === 'agent_hold_stranded_released')[0]
        .payload
    ).toMatchObject({ released: 0, net: 0 });
  });

  it('#622: a racing writer that read the same ledger state is a no-op (same key)', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    // Another writer read the same snapshot (h1, r0) and won the UNIQUE key first:
    // AccountsService answers alreadyExists for our write.
    w.accounts.registerTransaction.mockImplementationOnce(async () => ({
      success: true,
      alreadyExists: true,
    }));
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(w.releases()).toHaveLength(0);
    expect(
      w.events.filter((e) => e.event_type === 'agent_hold_stranded_released')[0]
        .payload
    ).toMatchObject({ released: 0 });
  });

  it('#622: claim -> release -> re-claim -> stranded: the second hold is released (a reference check would see the first release)', async () => {
    const w = world({ revertWins: false });
    w.ledger.push(
      {
        accountId: 'acct-agent-user-1',
        referenceId: 'order-1',
        amount: 700,
        type: 'release',
        key: 'first-cycle',
      },
      {
        accountId: 'acct-agent-user-1',
        referenceId: 'order-1',
        amount: 700,
        type: 'hold',
      }
    );
    await seedStranded(w);
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(w.releases().map((r) => [r.amount, r.key])).toEqual([
      [700, 'first-cycle'],
      [700, `stranded:release:${stranded(w)[0].id}`],
    ]);
  });

  it('QA #622 F1: credits min(net, stranded amount), never the whole net', async () => {
    const w = world({ revertWins: false });
    // A second, unrelated 300 hold on the same account and order (net 1000); the strand says 700.
    w.ledger.push({
      accountId: 'acct-agent-user-1',
      referenceId: 'order-1',
      amount: 300,
      type: 'hold',
    });
    await seedStranded(w);
    await w.service.reconcileStrandedAgentHolds();
    expect(w.releases().map((r) => r.amount)).toEqual([700]);
  });

  it('QA #622 F2: two overlapping runs (two pods) credit a strand once: the per-strand key collides', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    // Both runs read the strand as unresolved and the same net before either writes.
    const ev = { ...stranded(w)[0], payload: { ...stranded(w)[0].payload } };
    const a = (w.service as any).reconcileOneStrandedHold(ev);
    const b = (w.service as any).reconcileOneStrandedHold(ev);
    await expect(Promise.all([a, b])).resolves.toEqual([
      'released',
      'released',
    ]);
    expect(w.releases()).toHaveLength(1);
  });

  it('QA #622 F2: an overlapping run in the same process is skipped', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    const [a, b] = await Promise.all([
      w.service.reconcileStrandedAgentHolds(),
      w.service.reconcileStrandedAgentHolds(),
    ]);
    expect([a.released, b.released].sort()).toEqual([0, 1]);
    expect(w.releases()).toHaveLength(1);
  });

  it('QA #622 F3: resolved strands are filtered out and the oldest goes first, past a full page of newer ones', async () => {
    const w = world({ revertWins: false });
    const now = Date.now();
    const iso = (ms: number) => new Date(now - ms).toISOString();
    for (let i = 0; i < 3; i++) {
      w.events.push({
        id: `new-${i}`,
        order_id: 'order-1',
        event_type: 'agent_hold_stranded',
        payload: {
          agentUserId: 'agent-user-1',
          agentId: 'agent-1',
          amount: 1,
          resolvedAt: 'x',
        },
        created_at: iso(1000 + i),
      });
    }
    w.events.push({
      id: 'oldest',
      order_id: 'order-1',
      event_type: 'agent_hold_stranded',
      payload: {
        agentUserId: 'agent-user-1',
        agentId: 'agent-1',
        amount: 700,
        currency: 'XAF',
      },
      created_at: iso(86_400_000),
    });
    await expect(w.service.reconcileStrandedAgentHolds(1)).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(w.releases()).toEqual([
      expect.objectContaining({ key: 'stranded:release:oldest' }),
    ]);
  });

  it('QA #622 F3: an unresolved strand past the look-back alerts once (aged out)', async () => {
    const w = world({ revertWins: false });
    w.events.push({
      id: 'ancient',
      order_id: 'order-1',
      event_type: 'agent_hold_stranded',
      payload: { agentUserId: 'agent-user-1', amount: 700 },
      created_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    });
    await w.service.reconcileStrandedAgentHolds();
    await w.service.reconcileStrandedAgentHolds();
    expect(reportMoneyAnomaly).toHaveBeenCalledTimes(1);
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.any(Logger),
      'agent_hold_stranded_aged_out',
      expect.any(String),
      expect.objectContaining({ strandedEventId: 'ancient' })
    );
    expect(w.releases()).toEqual([]);
  });

  it('skipped while the same agent holds the order again (its hold is live)', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    w.state.current = 'agent-1';
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 0,
      skipped: 1,
      failed: 0,
    });
    expect(w.releases()).toEqual([]);
  });

  it('a failed release is counted, not resolved, and retried on the next run', async () => {
    const w = world({ revertWins: false });
    await seedStranded(w);
    w.accounts.registerTransaction.mockResolvedValueOnce({
      success: false,
      error: 'ledger down',
    } as any);
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 0,
      skipped: 0,
      failed: 1,
    });
    expect(
      w.events.filter((e) => e.event_type === 'agent_hold_stranded_released')
    ).toEqual([]);
    expect(stranded(w)[0].payload).not.toHaveProperty('resolvedAt');
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(w.releases()).toHaveLength(1);
  });

  it('no stranded events: one query, nothing else', async () => {
    const w = world();
    await expect(w.service.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 0,
      skipped: 0,
      failed: 0,
    });
    expect(w.accounts.registerTransaction).not.toHaveBeenCalled();
  });
});

describe('#622: creditHoldRelease goes through release_agent_order_hold', () => {
  const order = {
    id: 'order-1',
    order_number: 'ORD-1',
    currency: 'XAF',
    assigned_agent: { id: 'agent-1', user_id: 'agent-user-1' },
  };

  it('one call to the function, no cap, no key (derived under the lock); the net is released', async () => {
    const w = world();
    await expect((w.service as any).creditHoldRelease(order, { agent_hold_amount: 700 })).resolves.toBe(true);
    const calls = (w as any).executeMutation.mock.calls.filter(([q]: [string]) => q.includes('ReleaseAgentOrderHold'));
    expect(calls).toEqual([[expect.any(String), expect.objectContaining({ accountId: 'acct-agent-user-1', orderId: 'order-1', cap: null, key: null })]]);
    expect(w.releases().map((r) => r.amount)).toEqual([700]);
  });

  it('the function raising (e.g. withheld short) is a failure', async () => {
    const w = world();
    w.accounts.registerTransaction.mockResolvedValueOnce({ success: false, error: 'agent_hold_release_withheld_short' } as any);
    await expect((w.service as any).creditHoldRelease(order, { agent_hold_amount: 700 })).resolves.toBe(false);
  });
});
