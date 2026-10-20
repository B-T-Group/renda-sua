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
          const id = `ev-${++seq}`;
          events.push({ id, order_id: v.orderId, event_type: v.type, payload: structuredClone(v.payload), created_at: seq });
          return { insert_order_events_one: { id } };
        }
        case 'CasAdminCancelProgress': {
          const e = events.find((x) => x.id === v.id && contains(x.payload, v.expect));
          if (e) e.payload = structuredClone(v.payload);
          return { update_order_events: { affected_rows: e ? 1 : 0 } };
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
    updateOrderStatus: jest.fn(async () => {
      order.current_status = 'cancelled';
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
    await expect(w.svc.cancelOrderAsAdmin('o-1', 'again')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
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
    await expect(w.svc.cancelOrderAsAdmin('o-1', 'r')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    expect(w.svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('progress row insert fails: alerted, every step still runs once', async () => {
    const w = build({ deposit: true });
    const orig = w.hasura.executeMutation.getMockImplementation()!;
    w.hasura.executeMutation.mockImplementation(async (q: string, v: any) => {
      if (op(q) === 'InsertAdminCancelProgress') throw new Error('db');
      return orig(q, v);
    });
    const res: any = await w.svc.cancelOrderAsAdmin('o-1', 'r');
    expect(res).toMatchObject({ success: true, partialFailure: false });
    expect(failedAlerts()).toEqual(['progressMarker']);
    for (const fn of Object.values(w.m)) expect(fn).toHaveBeenCalledTimes(1);
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
});
