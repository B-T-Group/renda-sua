/**
 * #627 C4/C7/C8/I2: the admin-cancel step engine against an in-memory order_events
 * table whose CAS behaves like Postgres (UPDATE ... WHERE payload @> {version}).
 * The real-PG race is in admin-cancel-progress.pg.spec.ts.
 */
jest.mock('../notifications/notifications.service', () => ({ NotificationsService: class NotificationsService {} }));
jest.mock('../common/utils/money-alert.util', () => ({ reportMoneyAnomaly: jest.fn() }));
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { ADMIN_CANCEL_STEPS, ADMIN_CANCEL_PROGRESS_EVENT } from './admin-cancel-progress';
import { OrdersService } from './orders.service';

const op = (q: string) => /(?:query|mutation) (\w+)/.exec(q)?.[1] ?? '?';
const contains = (a: any, b: any): boolean =>
  Object.entries(b).every(([k, v]) => (v && typeof v === 'object' ? contains(a?.[k], v) : a?.[k] === v));

function build(opts: { status?: string; deposit?: boolean } = {}) {
  const events: Array<{ id: string; order_id: string; event_type: string; payload: any; created_at: number }> = [];
  let seq = 0;
  const order: any = {
    id: 'o-1',
    order_number: 'ORD-1',
    current_status: opts.status ?? 'confirmed',
    payment_source: 'credit_card',
    payment_status: 'authorized',
    deposit_status: opts.deposit ? 'paid' : null,
    deposit_amount: opts.deposit ? 500 : 0,
    order_items: [{ id: 'oi-1', business_inventory_id: 'bi-1', quantity: 2 }],
  };
  const hasura = {
    executeQuery: jest.fn(async (q: string, v: any) => {
      if (op(q) === 'AdminCancelToken') return { orders_by_pk: { admin_cancel_token: order.admin_cancel_token ?? null } };
      if (op(q) === 'AdminCancelProgress') {
        // C8: by order + type, no window over the newest events.
        const rows = events
          .filter((e) => e.order_id === v.orderId && e.event_type === v.type)
          .sort((a, b) => a.created_at - b.created_at);
        return { order_events: rows.slice(0, 1).map((e) => ({ id: e.id, payload: structuredClone(e.payload) })) };
      }
      throw new Error(`unexpected query ${op(q)}`);
    }),
    executeMutation: jest.fn(async (q: string, v: any) => {
      switch (op(q)) {
        case 'InsertAdminCancelProgress': {
          // Mirrors the partial unique index order_events_admin_cancel_progress_uniq.
          if (events.some((e) => e.order_id === v.orderId && e.event_type === v.type)) {
            throw new Error('Uniqueness violation. duplicate key value violates unique constraint "order_events_admin_cancel_progress_uniq"');
          }
          const id = `ev-${++seq}`;
          events.push({ id, order_id: v.orderId, event_type: v.type, payload: structuredClone(v.payload), created_at: seq });
          return { insert_order_events_one: { id } };
        }
        case 'CasAdminCancelProgress': {
          const e = events.find((x) => x.id === v.id && contains(x.payload, v.expect));
          if (e) e.payload = structuredClone(v.payload);
          return { update_order_events: { affected_rows: e ? 1 : 0 } };
        }
        case 'DeleteAdminCancelProgress': {
          const i = events.findIndex((x) => x.id === v.id && x.event_type === v.type && contains(x.payload, v.expect));
          if (i >= 0) events.splice(i, 1);
          return { delete_order_events: { affected_rows: i >= 0 ? 1 : 0 } };
        }
      }
      throw new Error(`unexpected mutation ${op(q)}`);
    }),
  };
  const svc = Object.create(OrdersService.prototype) as any;
  svc.logger = new Logger('OrdersService');
  svc.hasuraSystemService = hasura;
  svc.hasuraUserService = { getUser: jest.fn(async () => ({ id: 'admin-1' })) };
  svc.getOrderDetails = jest.fn(async () => ({ ...order }));
  svc.orderStatusService = {
    updateOrderStatus: jest.fn(async (_id: string, _to: string, o: any) => {
      if (order.current_status !== o.expectedFromStatus) throw new HttpException('moved', HttpStatus.CONFLICT);
      order.current_status = 'cancelled';
      order.admin_cancel_token = o.adminCancelToken ?? null;
      return { ...order };
    }),
  };
  const m = {
    stripe: jest.fn(async () => ({ ok: true }) as any),
    meta: jest.fn(async () => undefined),
    history: jest.fn(async () => undefined),
    credits: jest.fn(async () => undefined),
    stock: jest.fn(async () => undefined),
    hook: jest.fn(async () => undefined),
    refund: jest.fn(async () => ({ success: true }) as any),
    enqueue: jest.fn(async () => undefined),
  };
  svc.releaseStripeAuthorizationIfNeeded = m.stripe;
  svc.persistCancellationMetadata = m.meta;
  svc.createStatusHistoryEntry = m.history;
  svc.purchaseCreditsService = { restore: m.credits };
  svc.updateReservedQuantities = m.stock;
  svc.commerceOrderInventoryHook = { onOrderCancelledAfterCommit: m.hook };
  svc.depositRefundService = { refundDeposit: m.refund };
  svc.orderQueueService = { sendOrderCancelledMessage: m.enqueue };
  const steps = () => events.find((e) => e.event_type === ADMIN_CANCEL_PROGRESS_EVENT)?.payload.steps;
  return { svc, m, order, events, hasura, steps };
}

const KINDS = ['admin_cancel', 'full_refund'] as const;

const failedAlerts = () =>
  (reportMoneyAnomaly as jest.Mock).mock.calls.filter((c) => c[1] === 'admin_cancel_step_failed').map((c) => c[3].step);

describe('admin cancel step engine (#627 C4/C7/C8/I2)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (reportMoneyAnomaly as jest.Mock).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('clean cancel: every step once, in order, all done; lease released; fresh order returned (I2)', async () => {
    const w = build({ deposit: true });
    const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'Admin cancel');
    expect(res).toMatchObject({ success: true, partialFailure: false, failedSteps: [], resumed: false });
    expect(res.order.current_status).toBe('cancelled');
    expect(w.svc.orderStatusService.updateOrderStatus).toHaveBeenCalledWith('o-1', 'cancelled', expect.objectContaining({ expectedFromStatus: 'confirmed' }));
    for (const fn of Object.values(w.m)) expect(fn).toHaveBeenCalledTimes(1);
    expect(w.m.stock).toHaveBeenCalledWith(w.order.order_items, 'decrement');
    expect(w.m.refund).toHaveBeenCalledWith('o-1', { allowAfterLock: true });
    expect(w.m.enqueue).toHaveBeenCalledWith('o-1', 'system', 'Admin cancel', 'confirmed', 'order.cancelled:o-1', { strict: true });
    expect(w.steps()).toEqual(Object.fromEntries(ADMIN_CANCEL_STEPS.map((s) => [s, 'done'])));
    const p = w.events[0].payload;
    expect([p.leaseOwner, p.leaseUntil]).toEqual([null, null]);
    // A further retry on the completed cancel is refused, nothing re-runs.
    await expect(w.svc.cancelOrderAsAdmin('o-1', 'again')).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({ error: 'ORDER_ALREADY_CANCELLED' }),
    });
    expect(w.m.enqueue).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['stripe', 'voidStripeAuthorization', (w: any) => w.m.stripe.mockRejectedValueOnce(new Error('sk_live_x down'))],
    ['stripe ok:false', 'voidStripeAuthorization', (w: any) => w.m.stripe.mockResolvedValueOnce({ ok: false, message: 'card_declined internal' })],
    ['credits', 'restorePurchaseCredits', (w: any) => w.m.credits.mockRejectedValueOnce(new Error('db secret'))],
    ['stock', 'releaseReservedStock', (w: any) => w.m.stock.mockRejectedValueOnce(new Error('db secret'))],
    ['hook', 'inventoryReleaseHook', (w: any) => w.m.hook.mockRejectedValueOnce(new Error('db secret'))],
    ['deposit refund returns success:false', 'depositRefund', (w: any) => w.m.refund.mockResolvedValueOnce({ success: false, message: 'ledger secret' })],
    ['deposit refund throws', 'depositRefund', (w: any) => w.m.refund.mockRejectedValueOnce(new Error('ledger secret'))],
    ['SQS send', 'enqueueOrderCancelled', (w: any) => w.m.enqueue.mockRejectedValueOnce(new Error('sqs secret'))],
  ])('%s fails: listed in failedSteps + alerted, every other step still runs, no raw error text', async (_n, step, arrange) => {
    const w = build({ deposit: true });
    arrange(w);
    const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'r');
    expect(res).toMatchObject({ success: true, partialFailure: true, failedSteps: [step] });
    expect(failedAlerts()).toEqual([step]);
    for (const fn of Object.values(w.m)) expect(fn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(res)).not.toMatch(/secret|sk_live|card_declined/);
    expect(w.steps()[step]).toBe('failed');
  });

  it('enqueue fails, then a retry re-runs ONLY the enqueue (no second status CAS, nothing else twice)', async () => {
    const w = build({ deposit: true });
    w.m.enqueue.mockRejectedValueOnce(new Error('sqs'));
    await w.svc.cancelOrderAsAdmin('o-1', 'orig');
    const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'retry');
    expect(res).toMatchObject({ success: true, partialFailure: false, failedSteps: [], resumed: true });
    expect(w.svc.orderStatusService.updateOrderStatus).toHaveBeenCalledTimes(1);
    expect(w.m.enqueue).toHaveBeenCalledTimes(2);
    expect(w.m.enqueue).toHaveBeenLastCalledWith('o-1', 'system', 'orig', 'confirmed', 'order.cancelled:o-1', { strict: true });
    for (const k of ['stripe', 'meta', 'history', 'credits', 'stock', 'hook', 'refund'] as const) expect(w.m[k]).toHaveBeenCalledTimes(1);
  });

  it('two concurrent retries: only one proceeds (the other 409s), the failed step runs once', async () => {
    const w = build();
    w.m.enqueue.mockRejectedValueOnce(new Error('sqs'));
    await w.svc.cancelOrderAsAdmin('o-1', 'orig');
    let release!: () => void;
    w.m.enqueue.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const a = w.svc.cancelOrderAsAdmin('o-1', 'a').catch((e: unknown) => e);
    await new Promise((r) => setImmediate(r));
    const b = await w.svc.cancelOrderAsAdmin('o-1', 'b').catch((e: unknown) => e);
    expect(b).toBeInstanceOf(HttpException);
    expect((b as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    release();
    expect(await a).toMatchObject({ success: true, resumed: true, failedSteps: [] });
    expect(w.m.enqueue).toHaveBeenCalledTimes(2);
  });

  it('two retries racing the lease claim itself (same read version): exactly one wins the CAS', async () => {
    const w = build();
    w.m.enqueue.mockRejectedValueOnce(new Error('sqs'));
    await w.svc.cancelOrderAsAdmin('o-1', 'orig');
    const res = await Promise.all([
      w.svc.cancelOrderAsAdmin('o-1', 'a').catch((e: unknown) => e),
      w.svc.cancelOrderAsAdmin('o-1', 'b').catch((e: unknown) => e),
    ]);
    const conflicts = res.filter((r) => r instanceof HttpException && r.getStatus() === HttpStatus.CONFLICT);
    expect(conflicts).toHaveLength(1);
    expect(w.m.enqueue).toHaveBeenCalledTimes(2);
  });

  it('a step left running by a dead process: repeatable ones re-run, stock decrement is NOT re-run (at most once) and is alerted', async () => {
    const w = build();
    w.m.enqueue.mockRejectedValueOnce(new Error('sqs'));
    await w.svc.cancelOrderAsAdmin('o-1', 'orig');
    const p = w.events[0].payload;
    p.steps.releaseReservedStock = 'running';
    p.steps.restorePurchaseCredits = 'running';
    p.leaseOwner = 'dead';
    p.leaseUntil = new Date(Date.now() - 1000).toISOString(); // expired
    (reportMoneyAnomaly as jest.Mock).mockClear();
    const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'retry');
    expect(res.failedSteps).toEqual(['releaseReservedStock']);
    expect(failedAlerts()).toEqual(['releaseReservedStock']);
    expect(w.m.stock).toHaveBeenCalledTimes(1);
    expect(w.m.credits).toHaveBeenCalledTimes(2);
    expect(w.m.enqueue).toHaveBeenCalledTimes(2);
  });

  it('a live lease held by another request: 409, nothing runs', async () => {
    const w = build();
    w.m.enqueue.mockRejectedValueOnce(new Error('sqs'));
    await w.svc.cancelOrderAsAdmin('o-1', 'orig');
    Object.assign(w.events[0].payload, { leaseOwner: 'other', leaseUntil: new Date(Date.now() + 60_000).toISOString() });
    await expect(w.svc.cancelOrderAsAdmin('o-1', 'r')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    expect(w.m.enqueue).toHaveBeenCalledTimes(1);
  });

  it('C8: the progress row is found by type even behind many newer events', async () => {
    const w = build();
    w.m.enqueue.mockRejectedValueOnce(new Error('sqs'));
    await w.svc.cancelOrderAsAdmin('o-1', 'orig');
    for (let i = 0; i < 150; i++) w.events.push({ id: `n${i}`, order_id: 'o-1', event_type: 'admin_intervention', payload: {}, created_at: 1000 + i });
    const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'retry');
    expect(res.resumed).toBe(true);
    const [q, v] = w.hasura.executeQuery.mock.calls[w.hasura.executeQuery.mock.calls.length - 1];
    expect(q).toContain('event_type: { _eq: $type }');
    expect(v).toEqual({ orderId: 'o-1', type: 'admin_cancel_progress' });
  });

  it('a cancelled order without a progress row (cancelled elsewhere) is refused', async () => {
    const w = build({ status: 'cancelled' });
    await expect(w.svc.cancelOrderAsAdmin('o-1', 'r')).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({ error: 'ORDER_ALREADY_CANCELLED' }),
    });
    expect(w.svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
  });

  describe('QA #642 M1: the progress row is written before the status flips', () => {
    it('the status CAS stamps this row id as the ownership token (r2 N2)', async () => {
      const w = build();
      await w.svc.cancelOrderAsAdmin('o-1', 'r');
      expect(w.svc.orderStatusService.updateOrderStatus).toHaveBeenCalledWith(
        'o-1', 'cancelled', expect.objectContaining({ adminCancelToken: w.events[0].id, expectedFromStatus: 'confirmed' })
      );
      expect(w.order.admin_cancel_token).toBe(w.events[0].id);
    });

    it('QA r2 N1: a second progress row (unique violation) is 409 "held by another request"; nothing deleted, no CAS', async () => {
      const w = build();
      w.events.push({ id: 'ev-held', order_id: 'o-1', event_type: ADMIN_CANCEL_PROGRESS_EVENT, created_at: 0, payload: { version: 3 } });
      // The load misses it (the other request inserted after our read).
      w.hasura.executeQuery.mockImplementationOnce(async () => ({ order_events: [] }));
      const err: any = await w.svc.cancelOrderAsAdmin('o-1', 'r').catch((e: unknown) => e);
      expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(String(err.getResponse())).toMatch(/another request/);
      expect(w.events.map((e) => e.id)).toEqual(['ev-held']);
      expect(w.svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
      for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
    });

    describe('QA r2 N3: the statusCancelled update fails after a successful status CAS', () => {
      function failMarker(w: ReturnType<typeof build>, times: number, how: 'throw' | 'lose') {
        const orig = w.hasura.executeMutation.getMockImplementation()!;
        let n = 0;
        w.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
          if (op(q) === 'CasAdminCancelProgress' && v.payload?.statusCancelled === true && n < times) {
            n++;
            if (how === 'throw') throw new Error('db secret');
            return { update_order_events: { affected_rows: 0 } };
          }
          return orig(q, v);
        });
      }

      it.each(['throw', 'lose'] as const)('fails once (%s): retried, then every step runs', async (how) => {
        const w = build();
        failMarker(w, 1, how);
        const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'r');
        expect(res).toMatchObject({ success: true, partialFailure: false, failedSteps: [], stepsNotStarted: false });
        for (const fn of Object.values(w.m)) if (fn !== w.m.refund) expect(fn).toHaveBeenCalledTimes(1);
      });

      it('fails once because another request took the row over: NOT retried over it; not started, alerted', async () => {
        const w = build();
        const orig = w.hasura.executeMutation.getMockImplementation()!;
        let done = false;
        w.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
          if (!done && op(q) === 'CasAdminCancelProgress' && v.payload?.statusCancelled === true) {
            done = true;
            Object.assign(w.events[0].payload, { version: 9, leaseOwner: 'other' });
            return { update_order_events: { affected_rows: 0 } };
          }
          return orig(q, v);
        });
        const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'r');
        expect(res).toMatchObject({ stepsNotStarted: true, partialFailure: true });
        expect(w.events[0].payload).toMatchObject({ statusCancelled: false, leaseOwner: 'other', version: 9 });
        for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
      });

      it('fails twice: alerted, accurate partialFailure (no step ran, cancelled), NOT a 409; a retry runs them', async () => {
        const w = build();
        failMarker(w, 2, 'throw');
        const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'r');
        expect(res).toMatchObject({ success: true, partialFailure: true, stepsNotStarted: true, failedSteps: [...ADMIN_CANCEL_STEPS] });
        expect(res.message).toMatch(/did not start/);
        expect(res.order.current_status).toBe('cancelled');
        expect(JSON.stringify(res)).not.toMatch(/secret/);
        expect(failedAlerts()).toEqual(['progressMarker']);
        expect((reportMoneyAnomaly as jest.Mock).mock.calls[0][2]).toMatch(/^Admin cancel of order ORD-1: the order is cancelled but its progress row .* no follow-up step ran/);
        for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
        // Lease expires; the token proves ownership, so the retry runs every step once.
        w.events[0].payload.leaseUntil = new Date(Date.now() - 1000).toISOString();
        const again: any = await w.svc.cancelOrderAsAdmin('o-1', 'retry');
        expect(again).toMatchObject({ partialFailure: false, failedSteps: [] });
        for (const fn of Object.values(w.m)) if (fn !== w.m.refund) expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    it('row (statusCancelled=false, all pending) exists when the status CAS runs; set true after', async () => {
      const w = build();
      const seen: any[] = [];
      w.svc.orderStatusService.updateOrderStatus.mockImplementation(async () => {
        seen.push(structuredClone(w.events[0]?.payload));
        w.order.current_status = 'cancelled';
        return { ...w.order };
      });
      await w.svc.cancelOrderAsAdmin('o-1', 'r');
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ statusCancelled: false, kind: 'admin_cancel' });
      expect(Object.values(seen[0].steps)).toEqual(ADMIN_CANCEL_STEPS.map(() => 'pending'));
      expect(w.events[0].payload.statusCancelled).toBe(true);
    });

    it('row insert fails: 503, the order is NOT cancelled, no step runs', async () => {
      const w = build({ deposit: true });
      const orig = w.hasura.executeMutation.getMockImplementation()!;
      w.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
        if (op(q) === 'InsertAdminCancelProgress') throw new Error('db secret');
        return orig(q, v);
      });
      const err: any = await w.svc.cancelOrderAsAdmin('o-1', 'r').catch((e: unknown) => e);
      expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(JSON.stringify(err.getResponse())).not.toMatch(/secret/);
      expect(w.svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
      for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
    });

    it('status CAS loses: our row is deleted, the 409 propagates, nothing runs', async () => {
      const w = build();
      w.svc.orderStatusService.updateOrderStatus.mockRejectedValueOnce(new HttpException('moved', HttpStatus.CONFLICT));
      await expect(w.svc.cancelOrderAsAdmin('o-1', 'r')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(w.events).toHaveLength(0);
      for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
      expect(failedAlerts()).toEqual([]);
    });

    it('status CAS loses and the row cannot be removed: alerted (progressMarker)', async () => {
      const w = build();
      w.svc.orderStatusService.updateOrderStatus.mockRejectedValueOnce(new HttpException('moved', HttpStatus.CONFLICT));
      const orig = w.hasura.executeMutation.getMockImplementation()!;
      w.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
        if (op(q) === 'DeleteAdminCancelProgress') return { delete_order_events: { affected_rows: 0 } };
        return orig(q, v);
      });
      await expect(w.svc.cancelOrderAsAdmin('o-1', 'r')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(failedAlerts()).toEqual(['progressMarker']);
    });

    /** Simulates a crash right after the row insert (statusCancelled=false, lease expired). */
    function crashed(w: ReturnType<typeof build>, status: string) {
      w.events.push({
        id: 'ev-x', order_id: 'o-1', event_type: ADMIN_CANCEL_PROGRESS_EVENT, created_at: 1,
        payload: {
          version: 1, kind: 'admin_cancel', previousStatus: 'confirmed', notes: 'orig', adminUserId: 'admin-1',
          steps: Object.fromEntries(ADMIN_CANCEL_STEPS.map((n) => [n, 'pending'])),
          leaseOwner: 'dead', leaseUntil: new Date(Date.now() - 1000).toISOString(), statusCancelled: false,
        },
      });
      w.order.current_status = status;
    }

    it('crash before the status CAS: the retry does the CAS, then every step once', async () => {
      const w = build();
      crashed(w, 'confirmed');
      const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'retry');
      expect(res).toMatchObject({ success: true, resumed: true, failedSteps: [] });
      expect(w.svc.orderStatusService.updateOrderStatus).toHaveBeenCalledWith('o-1', 'cancelled', expect.objectContaining({ expectedFromStatus: 'confirmed', adminCancelToken: 'ev-x' }));
      expect(w.order.admin_cancel_token).toBe('ev-x');
      for (const fn of Object.values(w.m)) if (fn !== w.m.refund) expect(fn).toHaveBeenCalledTimes(1);
      expect(w.events[0].payload.statusCancelled).toBe(true);
      expect(Object.values(w.steps())).toEqual(ADMIN_CANCEL_STEPS.map(() => 'done'));
    });

    it('QA r2 N2: crash after OUR status CAS (token = this row): every step runs once (none had run)', async () => {
      const w = build();
      crashed(w, 'cancelled');
      w.order.admin_cancel_token = 'ev-x';
      const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'retry');
      expect(res).toMatchObject({ success: true, resumed: true, failedSteps: [], partialFailure: false });
      expect(w.svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
      for (const fn of Object.values(w.m)) if (fn !== w.m.refund) expect(fn).toHaveBeenCalledTimes(1);
      expect(w.events[0].payload.statusCancelled).toBe(true);
    });

    it.each([
      ['a client / other-flow cancel (no token)', null],
      ['another admin cancel (other token)', 'ev-other'],
    ])('QA r2 N2: pre-CAS crash, then %s: alert, 409, row abandoned, NOTHING touched', async (_l, token) => {
      const w = build({ deposit: true });
      crashed(w, 'cancelled');
      w.order.admin_cancel_token = token;
      await expect(w.svc.cancelOrderAsAdmin('o-1', 'retry')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: expect.objectContaining({ error: 'ORDER_ALREADY_CANCELLED' }),
      });
      for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
      expect(w.svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
      expect(failedAlerts()).toEqual(['ownership']);
      expect(w.events[0].payload).toMatchObject({ abandoned: true, leaseOwner: null, statusCancelled: false });
      // A later retry is refused without running or alerting again.
      (reportMoneyAnomaly as jest.Mock).mockClear();
      await expect(w.svc.cancelOrderAsAdmin('o-1', 'again')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
      expect(failedAlerts()).toEqual([]);
    });

    it('crash before the CAS, then the status moved on (picked up): row dropped, refused, nothing runs', async () => {
      const w = build();
      crashed(w, 'picked_up');
      await expect(w.svc.cancelOrderAsAdmin('o-1', 'retry')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(w.events).toHaveLength(0);
      for (const fn of Object.values(w.m)) expect(fn).not.toHaveBeenCalled();
    });

    it('crash before the CAS, retry CAS loses: row dropped, 409', async () => {
      const w = build();
      crashed(w, 'confirmed');
      w.svc.orderStatusService.updateOrderStatus.mockRejectedValueOnce(new HttpException('moved', HttpStatus.CONFLICT));
      await expect(w.svc.cancelOrderAsAdmin('o-1', 'retry')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(w.events).toHaveLength(0);
      expect(w.m.enqueue).not.toHaveBeenCalled();
    });
  });

  it('deposit not paid: no refund call; inventory hook skipped for pending_payment', async () => {
    const w = build({ status: 'pending_payment' });
    await w.svc.cancelOrderAsAdmin('o-1', 'r');
    expect(w.m.refund).not.toHaveBeenCalled();
    expect(w.m.hook).not.toHaveBeenCalled();
  });

  it('at most once: a step is durably marked running BEFORE it runs', async () => {
    const w = build();
    const seen: string[] = [];
    w.m.stock.mockImplementation(async () => {
      seen.push(w.steps().releaseReservedStock);
    });
    await w.svc.cancelOrderAsAdmin('o-1', 'r');
    expect(seen).toEqual(['running']);
  });

  it('a holder whose lease was taken over mid-run stops with 409; later steps do not run', async () => {
    const w = build();
    w.m.credits.mockImplementation(async () => {
      // Another request took the (expired) lease: the version moved on.
      w.events[0].payload = { ...w.events[0].payload, version: w.events[0].payload.version + 1, leaseOwner: 'other' };
    });
    await expect(w.svc.cancelOrderAsAdmin('o-1', 'r')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    expect(w.m.stock).not.toHaveBeenCalled();
    expect(w.m.enqueue).not.toHaveBeenCalled();
  });

  describe('#627 nit: admin acknowledgement of a half-done stock / hook step', () => {
    async function halfDone(step: 'releaseReservedStock' | 'inventoryReleaseHook') {
      const w = build();
      w.m.enqueue.mockRejectedValueOnce(new Error('sqs'));
      await w.svc.cancelOrderAsAdmin('o-1', 'orig');
      const p = w.events[0].payload;
      p.steps[step] = 'running';
      p.leaseOwner = 'dead';
      p.leaseUntil = new Date(Date.now() - 1000).toISOString();
      return w;
    }

    it.each(['releaseReservedStock', 'inventoryReleaseHook'] as const)(
      'without it, every retry alerts on %s; after it, retries skip the step silently and finish',
      async (step) => {
        const w = await halfDone(step);
        (reportMoneyAnomaly as jest.Mock).mockClear();
        await w.svc.cancelOrderAsAdmin('o-1', 'retry1');
        await w.svc.cancelOrderAsAdmin('o-1', 'retry2');
        expect(failedAlerts()).toEqual([step, step]);
        const ack = await w.svc.acknowledgeAdminCancelStep('o-1', step, 'stock recounted by ops', KINDS);
        expect(ack).toMatchObject({ success: true, step, from: 'running', pendingSteps: [] });
        const p = w.events[0].payload;
        expect(p.steps[step]).toBe('done');
        expect(p.acknowledged[step]).toMatchObject({ by: 'admin-1', note: 'stock recounted by ops', from: 'running' });
        (reportMoneyAnomaly as jest.Mock).mockClear();
        const before = [w.m.stock.mock.calls.length, w.m.hook.mock.calls.length];
        // Nothing left: the cancel is complete, a retry is refused and nothing runs or alerts.
        await expect(w.svc.cancelOrderAsAdmin('o-1', 'retry3')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
        expect(failedAlerts()).toEqual([]);
        expect([w.m.stock.mock.calls.length, w.m.hook.mock.calls.length]).toEqual(before);
      }
    );

    it('a failed (not just running) stock step can be acknowledged too', async () => {
      const w = build();
      w.m.stock.mockRejectedValueOnce(new Error('db'));
      await w.svc.cancelOrderAsAdmin('o-1', 'orig');
      expect(w.events[0].payload.steps.releaseReservedStock).toBe('failed');
      await expect(w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'fixed by hand', KINDS)).resolves.toMatchObject({ from: 'failed' });
    });

    it.each([
      ['a repeatable step', 'enqueueOrderCancelled', 'running'],
      ['an unknown step', 'dropTables', 'running'],
      ['a stock step that is done', 'releaseReservedStock', 'done'],
      ['a stock step still pending', 'releaseReservedStock', 'pending'],
    ])('refuses %s (409 STEP_NOT_ACKNOWLEDGEABLE), the row is unchanged', async (_l, step, state) => {
      const w = await halfDone('releaseReservedStock');
      w.events[0].payload.steps[step] = state;
      const before = structuredClone(w.events[0].payload);
      const err: any = await w.svc.acknowledgeAdminCancelStep('o-1', step, 'n', KINDS).catch((e: unknown) => e);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toMatchObject({ error: 'STEP_NOT_ACKNOWLEDGEABLE' });
      expect(w.events[0].payload).toEqual(before);
    });

    it('refused while a resume holds the lease, and when the row moved meanwhile (CAS)', async () => {
      const w = await halfDone('releaseReservedStock');
      Object.assign(w.events[0].payload, { leaseOwner: 'other', leaseUntil: new Date(Date.now() + 60_000).toISOString() });
      await expect(w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'n', KINDS)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(w.events[0].payload.steps.releaseReservedStock).toBe('running');
      Object.assign(w.events[0].payload, { leaseOwner: null, leaseUntil: null });
      const real = w.hasura.executeQuery.getMockImplementation()!;
      w.hasura.executeQuery.mockImplementationOnce(async (q: string, v: any) => {
        const r = await real(q, v);
        w.events[0].payload.version += 1; // someone wrote after our read
        return r;
      });
      await expect(w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'n', KINDS)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(w.events[0].payload.steps.releaseReservedStock).toBe('running');
    });

    it('QA #642 Low: a repeat acknowledge is an idempotent 200 with the first acknowledgement, row unchanged', async () => {
      const w = await halfDone('releaseReservedStock');
      const first: any = await w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'first', KINDS);
      expect(first.alreadyAcknowledged).toBe(false);
      const before = structuredClone(w.events[0].payload);
      const again: any = await w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'second', KINDS);
      expect(again).toMatchObject({ success: true, alreadyAcknowledged: true, from: 'running', acknowledged: { note: 'first', by: 'admin-1' } });
      expect(w.events[0].payload).toEqual(before);
    });

    it('a done step without an acknowledgement is still refused (409), not reported as acknowledged', async () => {
      const w = await halfDone('releaseReservedStock');
      w.events[0].payload.steps.releaseReservedStock = 'done';
      await expect(w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'n', KINDS)).rejects.toMatchObject({ status: 409 });
    });

    it.each([
      ['a kind the caller did not allow', 'full_refund', ['admin_cancel']],
      ['an unknown kind', 'something_else', KINDS],
      ['a legacy row (no kind = admin_cancel) when only full_refund is allowed', undefined, ['full_refund']],
    ])('QA #642 H1: refuses %s (403 CANCEL_KIND_NOT_ALLOWED), row unchanged', async (_l, kind, allowed) => {
      const w = await halfDone('releaseReservedStock');
      if (kind === undefined) delete w.events[0].payload.kind;
      else w.events[0].payload.kind = kind;
      const before = structuredClone(w.events[0].payload);
      const err: any = await w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'n', allowed).catch((e: unknown) => e);
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toMatchObject({ error: 'CANCEL_KIND_NOT_ALLOWED' });
      expect(w.events[0].payload).toEqual(before);
    });

    it('QA #642 H1: a full_refund row is acknowledgeable when allowed', async () => {
      const w = await halfDone('releaseReservedStock');
      w.events[0].payload.kind = 'full_refund';
      await expect(w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'n', KINDS)).resolves.toMatchObject({ success: true });
    });

    it('no progress row: 404', async () => {
      const w = build();
      await expect(w.svc.acknowledgeAdminCancelStep('o-1', 'releaseReservedStock', 'n', KINDS)).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });
});
