/**
 * Admin full-refund cancel (ops cleanup): superuser / financial-refunds admin only,
 * cancel as `system` (no cancellation fee; the order.cancelled Lambda releases the
 * client and agent holds under per-order idempotency keys), compare-and-set so it
 * runs exactly once, refused after pickup, and audit-logged only on success.
 * SQS enqueue is strict; a retry on the same full-refund cancel re-queues it.
 */
jest.mock('../notifications/notifications.service', () => ({ NotificationsService: class NotificationsService {} }));
jest.mock('../common/utils/money-alert.util', () => ({ reportMoneyAnomaly: jest.fn() }));
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

const op = (q: string) => /(?:query|mutation) (\w+)/.exec(q)?.[1] ?? '?';
const contains = (a: any, b: any): boolean =>
  Object.entries(b).every(([k, v]) => (v && typeof v === 'object' ? contains(a?.[k], v) : a?.[k] === v));
const GENERIC = 'Step failed; details are in the logs (alerted)';
const FULL_STEPS = [
  'voidStripeAuthorization',
  'supersedePendingOrderTxs',
  'persistCancellationMetadata',
  'createStatusHistoryEntry',
  'restorePurchaseCredits',
  'releaseReservedStock',
  'inventoryReleaseHook',
  'depositRefund',
  'enqueueOrderCancelled',
];
// Each engine step -> the collaborator it calls (as recorded in `calls`).
const CALL = {
  voidStripeAuthorization: 'releaseStripeAuthorizationIfNeeded',
  supersedePendingOrderTxs: 'supersedePendingOrderTxsOnCancel',
  persistCancellationMetadata: 'persistCancellationMetadata',
  createStatusHistoryEntry: 'createStatusHistoryEntry',
  restorePurchaseCredits: 'restore',
  releaseReservedStock: 'updateReservedQuantities',
  inventoryReleaseHook: 'onOrderCancelledAfterCommit',
  depositRefund: 'refundDeposit',
  enqueueOrderCancelled: 'sendOrderCancelledMessage',
} as const;

/** OrdersService with an in-memory order_events table whose CAS behaves like Postgres. */
function service(start: string, opts: { deposit?: boolean; legacy?: { cancelled_by: string; cancellation_notes: string } } = {}) {
  const db = { status: start };
  const events: Array<{ id: string; order_id: string; event_type: string; payload: any; created_at: number }> = [];
  let seq = 0;
  const calls: string[] = [];
  const order: any = {
    id: 'o-1',
    order_number: 'ORD-1',
    current_status: start,
    deposit_status: opts.deposit ? 'paid' : null,
    deposit_amount: opts.deposit ? 500 : 0,
    order_items: [{ id: 'oi-1', business_inventory_id: 'bi-1', quantity: 1 }],
    cancelled_by: opts.legacy?.cancelled_by ?? null,
    cancellation_notes: opts.legacy?.cancellation_notes ?? null,
  };
  const svc = Object.create(OrdersService.prototype) as any;
  svc.hasuraSystemService = {
    executeQuery: jest.fn(async (q: string, v: any) => {
      if (op(q) !== 'AdminCancelProgress') throw new Error(`unexpected query ${op(q)}`);
      const rows = events.filter((e) => e.order_id === v.orderId && e.event_type === v.type);
      return { order_events: rows.slice(0, 1).map((e) => ({ id: e.id, payload: structuredClone(e.payload) })) };
    }),
    executeMutation: jest.fn(async (q: string, v: any) => {
      if (op(q) === 'InsertAdminCancelProgress') {
        const id = `ev-${++seq}`;
        events.push({ id, order_id: v.orderId, event_type: v.type, payload: structuredClone(v.payload), created_at: seq });
        return { insert_order_events_one: { id } };
      }
      if (op(q) === 'CasAdminCancelProgress') {
        const e = events.find((x) => x.id === v.id && contains(x.payload, v.expect));
        if (e) e.payload = structuredClone(v.payload);
        return { update_order_events: { affected_rows: e ? 1 : 0 } };
      }
      throw new Error(`unexpected mutation ${op(q)}`);
    }),
  };
  svc.getOrderDetails = jest.fn(async () => ({ ...order, current_status: db.status }));
  svc.hasuraUserService = { getUser: jest.fn(async () => ({ id: 'admin-1' })) };
  svc.getPreviousStatusBeforeCancelled = jest.fn(async () => 'assigned_to_agent');
  // Mirrors OrderStatusService: the cancel is a compare-and-set on expectedFromStatus.
  svc.orderStatusService = {
    updateOrderStatus: jest.fn(async (_id: string, to: string, o: any) => {
      if (db.status === 'cancelled' || db.status !== o.expectedFromStatus) {
        throw new HttpException('Order status already changed. Please refresh and try again.', 409);
      }
      db.status = to;
      return { id: 'o-1', current_status: to };
    }),
  };
  const rec = (name: string, ret?: any) => jest.fn(async () => (calls.push(name), ret));
  svc.releaseStripeAuthorizationIfNeeded = rec('releaseStripeAuthorizationIfNeeded', { ok: true });
  svc.supersedePendingOrderTxsOnCancel = rec('supersedePendingOrderTxsOnCancel');
  svc.persistCancellationMetadata = rec('persistCancellationMetadata');
  svc.createStatusHistoryEntry = rec('createStatusHistoryEntry');
  svc.purchaseCreditsService = { restore: rec('restore') };
  svc.updateReservedQuantities = rec('updateReservedQuantities');
  svc.commerceOrderInventoryHook = { onOrderCancelledAfterCommit: rec('onOrderCancelledAfterCommit') };
  svc.depositRefundService = { refundDeposit: rec('refundDeposit', { success: true }) };
  svc.orderQueueService = { sendOrderCancelledMessage: rec('sendOrderCancelledMessage') };
  svc.enqueueAdminFullRefundCancelled = rec('enqueueAdminFullRefundCancelled');
  svc.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  const progress = () => events[0]?.payload;
  // A collaborator by engine step name, to inject failures.
  const fn = (step: keyof typeof CALL): jest.Mock =>
    ({
      voidStripeAuthorization: svc.releaseStripeAuthorizationIfNeeded,
      supersedePendingOrderTxs: svc.supersedePendingOrderTxsOnCancel,
      persistCancellationMetadata: svc.persistCancellationMetadata,
      createStatusHistoryEntry: svc.createStatusHistoryEntry,
      restorePurchaseCredits: svc.purchaseCreditsService.restore,
      releaseReservedStock: svc.updateReservedQuantities,
      inventoryReleaseHook: svc.commerceOrderInventoryHook.onOrderCancelledAfterCommit,
      depositRefund: svc.depositRefundService.refundDeposit,
      enqueueOrderCancelled: svc.orderQueueService.sendOrderCancelledMessage,
    })[step];
  return { svc, db, calls, order, events, progress, fn };
}

const alerts = (marker: string) =>
  (reportMoneyAnomaly as jest.Mock).mock.calls.filter((c) => c[1] === marker);

describe('OrdersService.adminFullRefundCancel', () => {
  beforeEach(() => (reportMoneyAnomaly as jest.Mock).mockClear());

  it('cancels as system (no fee), reason on the metadata and history, every step once in order, progress row kind full_refund', async () => {
    const { svc, db, calls, progress } = service('ready_for_pickup', { deposit: true });
    await expect(svc.adminFullRefundCancel('o-1', 'QA leftover')).resolves.toMatchObject({
      success: true,
      resumed: false,
      partialFailure: false,
      failedSteps: [],
      previousStatus: 'ready_for_pickup',
      cancellationFee: 0,
      depositRefund: { status: 'refunded' },
    });
    expect(db.status).toBe('cancelled');
    expect(svc.orderStatusService.updateOrderStatus).toHaveBeenCalledWith('o-1', 'cancelled', { viaCancelEndpoint: true, viaSystem: true, expectedFromStatus: 'ready_for_pickup' });
    expect(svc.persistCancellationMetadata).toHaveBeenCalledWith('o-1', 'system', 'Admin full refund: QA leftover');
    expect(svc.createStatusHistoryEntry).toHaveBeenCalledWith('o-1', 'cancelled', expect.stringContaining('full refund'), 'system', 'admin-1', 'Admin full refund: QA leftover');
    expect(svc.depositRefundService.refundDeposit).toHaveBeenCalledWith('o-1', { allowAfterLock: true });
    expect(svc.orderQueueService.sendOrderCancelledMessage).toHaveBeenCalledWith(
      'o-1', 'system', 'Admin full refund: QA leftover', 'ready_for_pickup', 'order.cancelled:o-1', { strict: true }
    );
    expect(calls).toEqual(FULL_STEPS.map((s) => CALL[s as keyof typeof CALL]));
    expect(progress()).toMatchObject({ kind: 'full_refund', leaseOwner: null, leaseUntil: null });
    expect(progress().steps).toEqual(Object.fromEntries(FULL_STEPS.map((s) => [s, 'done'])));
  });

  it('two concurrent calls: one wins, the other gets 409 before any side effect (exactly once)', async () => {
    const { svc, calls } = service('assigned_to_agent');
    const results = await Promise.allSettled([svc.adminFullRefundCancel('o-1', 'r1'), svc.adminFullRefundCancel('o-1', 'r2')]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((lost.reason as HttpException).getStatus()).toBe(409);
    // No deposit on this order, so the refund service is not called.
    for (const c of Object.values(CALL)) expect(calls.filter((x) => x === c)).toHaveLength(c === 'refundDeposit' ? 0 : 1);
  });

  it('resumable: the enqueue fails, a retry runs ONLY the enqueue (no second CAS, nothing else re-run)', async () => {
    const { svc, db, calls, progress, fn } = service('confirmed');
    fn('enqueueOrderCancelled').mockRejectedValueOnce(new Error('sqs down'));
    const first = await svc.adminFullRefundCancel('o-1', 'r');
    expect(db.status).toBe('cancelled');
    expect(first).toMatchObject({ partialFailure: true, failedSteps: [{ step: 'enqueueOrderCancelled', error: GENERIC }] });
    expect(JSON.stringify(first)).not.toContain('sqs down');
    expect(alerts('admin_full_refund_cancel_step_failed').map((c) => c[3].step)).toEqual(['enqueueOrderCancelled']);
    expect(alerts('admin_full_refund_cancel_step_failed')[0][2]).toContain('sqs down');
    expect(progress().steps.enqueueOrderCancelled).toBe('failed');
    calls.length = 0;
    await expect(svc.adminFullRefundCancel('o-1', 'retry')).resolves.toMatchObject({
      success: true, resumed: true, partialFailure: false, failedSteps: [], previousStatus: 'confirmed',
    });
    expect(calls).toEqual(['sendOrderCancelledMessage']);
    expect(svc.orderStatusService.updateOrderStatus).toHaveBeenCalledTimes(1);
    expect(progress().steps.enqueueOrderCancelled).toBe('done');
    // Done: a third call is refused, nothing runs.
    calls.length = 0;
    const third = await svc.adminFullRefundCancel('o-1', 'again').catch((e: unknown) => e);
    expect((third as HttpException).getStatus()).toBe(409);
    expect((third as HttpException).getResponse()).toMatchObject({ error: 'ORDER_ALREADY_CANCELLED' });
    expect(calls).toEqual([]);
  });

  it('single resume: two concurrent retries, only one proceeds (the other 409s)', async () => {
    const { svc, calls, fn } = service('confirmed');
    fn('enqueueOrderCancelled').mockRejectedValueOnce(new Error('sqs down'));
    await svc.adminFullRefundCancel('o-1', 'r');
    calls.length = 0;
    const rs = await Promise.allSettled([svc.adminFullRefundCancel('o-1', 'a'), svc.adminFullRefundCancel('o-1', 'b')]);
    expect(rs.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(((rs.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason as HttpException).getStatus()).toBe(409);
    expect(calls).toEqual(['sendOrderCancelledMessage']);
  });

  it('a live lease (another resume running) refuses a retry with 409 and runs nothing', async () => {
    const { svc, calls, fn, events } = service('confirmed');
    fn('enqueueOrderCancelled').mockRejectedValueOnce(new Error('sqs down'));
    await svc.adminFullRefundCancel('o-1', 'r');
    events[0].payload.leaseOwner = 'other';
    events[0].payload.leaseUntil = new Date(Date.now() + 60_000).toISOString();
    calls.length = 0;
    const err = await svc.adminFullRefundCancel('o-1', 'x').catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(409);
    expect(calls).toEqual([]);
  });

  it('a plain admin-cancel progress row is not resumed through the full-refund endpoint (409 ORDER_ALREADY_CANCELLED)', async () => {
    const { svc, events, calls } = service('cancelled');
    events.push({ id: 'ev-x', order_id: 'o-1', event_type: 'admin_cancel_progress', created_at: 0,
      payload: { version: 1, previousStatus: 'confirmed', notes: null, adminUserId: null, steps: { enqueueOrderCancelled: 'failed' }, leaseOwner: null, leaseUntil: null } });
    const err = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    expect((err as HttpException).getResponse()).toMatchObject({ error: 'ORDER_ALREADY_CANCELLED' });
    expect(calls).toEqual([]);
  });

  it('and a full-refund row is not resumed through PATCH cancel (409 ORDER_ALREADY_CANCELLED)', async () => {
    const { svc, fn, calls } = service('confirmed');
    fn('enqueueOrderCancelled').mockRejectedValueOnce(new Error('sqs down'));
    await svc.adminFullRefundCancel('o-1', 'r');
    calls.length = 0;
    const err = await svc.cancelOrderAsAdmin('o-1', 'r').catch((e: unknown) => e);
    expect((err as HttpException).getResponse()).toMatchObject({ error: 'ORDER_ALREADY_CANCELLED' });
    expect(calls).toEqual([]);
  });

  it('legacy (cancelled by this endpoint before the step engine, no progress row): a retry re-queues only', async () => {
    const { svc, calls } = service('cancelled', { legacy: { cancelled_by: 'system', cancellation_notes: 'Admin full refund: old' } });
    await expect(svc.adminFullRefundCancel('o-1', 'r')).resolves.toMatchObject({ success: true, resumed: true, previousStatus: 'assigned_to_agent' });
    expect(calls).toEqual(['enqueueAdminFullRefundCancelled']);
    expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('a cancelled order that was not a full-refund cancel is still refused', async () => {
    const { svc, calls } = service('cancelled');
    const err = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(409);
    expect((err as HttpException).getResponse()).toMatchObject({ error: 'ORDER_ALREADY_CANCELLED' });
    expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('enqueueAdminFullRefundCancelled (legacy path) sends order.cancelled as system with strict: true', async () => {
    const svc = Object.create(OrdersService.prototype) as any;
    svc.orderQueueService = { sendOrderCancelledMessage: jest.fn(async () => undefined) };
    await svc.enqueueAdminFullRefundCancelled('o-1', 'confirmed', 'Admin full refund: r');
    expect(svc.orderQueueService.sendOrderCancelledMessage).toHaveBeenCalledWith(
      'o-1', 'system', 'Admin full refund: r', 'confirmed', 'order.cancelled:o-1', { strict: true }
    );
  });

  // Every value of public.order_status (rs_base enum_range), so a new status is a conscious choice.
  const ALL_ORDER_STATUSES = [
    'pending_payment', 'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned_to_agent',
    'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'complete', 'refund_requested',
    'refund_approved_full', 'refund_approved_partial', 'refund_rejected', 'refund_processing',
    'refund_failed', 'cancelled', 'failed', 'refunded', 'refund_approved_replace',
    'awaiting_shipment', 'shipped', 'in_delivery',
  ];
  const ALLOWED = ['pending_payment', 'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned_to_agent'];
  it.each(ALL_ORDER_STATUSES.map((s) => [s, ALLOWED.includes(s)] as const))('QA A1 allowlist: %s -> allowed=%s', async (status, allowed) => {
    const { svc, db, calls } = service(status);
    const res = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    if (allowed) {
      expect(res).toMatchObject({ success: true });
      expect(db.status).toBe('cancelled');
    } else {
      expect(res).toBeInstanceOf(HttpException);
      expect((res as HttpException).getStatus()).toBe(409);
      expect((res as HttpException).getResponse()).toMatchObject({ error: status === 'cancelled' ? 'ORDER_ALREADY_CANCELLED' : 'ORDER_ALREADY_PICKED_UP' });
      expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
    }
  });

  it('QA A2 / D2: a failed deposit refund is reported (deposit alert, generic depositRefund), never claimed as a full refund; a retry re-runs only it', async () => {
    const { svc, fn, calls } = service('confirmed', { deposit: true });
    fn('depositRefund').mockResolvedValueOnce({ success: false, message: 'Deposit already consumed' });
    const res = await svc.adminFullRefundCancel('o-1', 'r');
    expect(res.depositRefund).toEqual({ status: 'failed', message: 'Deposit refund failed; details are in the logs (alerted)' });
    expect(JSON.stringify(res)).not.toContain('Deposit already consumed');
    expect(res.message).toMatch(/DEPOSIT REFUND FAILED/);
    expect(res.message).not.toMatch(/with a full refund/);
    const a = alerts('admin_full_refund_cancel_deposit_refund_failed');
    expect(a).toHaveLength(1);
    expect(a[0][2]).toContain('Deposit already consumed');
    expect(a[0][3]).toMatchObject({ orderId: 'o-1', step: 'depositRefund' });
    calls.length = 0;
    await expect(svc.adminFullRefundCancel('o-1', 'r')).resolves.toMatchObject({ partialFailure: false, depositRefund: { status: 'refunded' } });
    expect(calls).toEqual(['refundDeposit']);
  });

  it('no deposit -> depositRefund none, the refund service is not called, full refund message', async () => {
    const { svc } = service('confirmed');
    const res = await svc.adminFullRefundCancel('o-1', 'r');
    expect(res.depositRefund).toEqual({ status: 'none' });
    expect(svc.depositRefundService.refundDeposit).not.toHaveBeenCalled();
    expect(res.message).toMatch(/full refund to the client wallet/);
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
  });

  it.each(FULL_STEPS.filter((s) => s !== 'depositRefund'))(
    'a failure in %s alerts, is a generic failedStep (no 500, no raw text); every later step still runs',
    async (step) => {
      const { svc, db, calls, fn } = service('confirmed');
      fn(step as keyof typeof CALL).mockRejectedValueOnce(new Error('boom'));
      const res = await svc.adminFullRefundCancel('o-1', 'r');
      expect(db.status).toBe('cancelled');
      expect(res).toMatchObject({ success: true, partialFailure: true, failedSteps: [{ step, error: GENERIC }] });
      expect(JSON.stringify(res)).not.toContain('boom');
      expect(res.message).toMatch(/FAILED and needs manual follow-up/);
      expect(alerts('admin_full_refund_cancel_step_failed')[0][3]).toMatchObject({ orderId: 'o-1', step });
      // The failing collaborator threw before recording; every other step ran (no deposit here).
      expect(calls).toEqual(
        FULL_STEPS.filter((s) => s !== step).map((s) => CALL[s as keyof typeof CALL]).filter((c) => c !== 'refundDeposit')
      );
    }
  );

  it('#626 D1: a Stripe void that fails WITHOUT throwing ({ ok: false }) is a failed step, alerted, the rest still runs', async () => {
    const { svc, calls } = service('confirmed');
    svc.releaseStripeAuthorizationIfNeeded.mockResolvedValueOnce({ ok: false, message: 'pi secret detail' });
    const res = await svc.adminFullRefundCancel('o-1', 'r');
    expect(res).toMatchObject({ success: true, partialFailure: true });
    expect(res.failedSteps).toEqual([{ step: 'voidStripeAuthorization', error: GENERIC }]);
    expect(JSON.stringify(res)).not.toContain('pi secret detail');
    expect(alerts('admin_full_refund_cancel_step_failed')[0][2]).toContain('pi secret detail');
    expect(calls).toContain('sendOrderCancelledMessage');
  });

  it.each([[{ ok: true }], [undefined]])('#626 D1: a void result %o is not a failure', async (r) => {
    const { svc } = service('confirmed');
    svc.releaseStripeAuthorizationIfNeeded.mockResolvedValueOnce(r);
    await expect(svc.adminFullRefundCancel('o-1', 'r')).resolves.toMatchObject({ partialFailure: false, failedSteps: [] });
  });

  it('#626 D1: releaseStripeAuthorizationIfNeeded reports a non-throwing Stripe failure as { ok: false }', async () => {
    const real = (OrdersService.prototype as any).releaseStripeAuthorizationIfNeeded;
    const self: any = { logger: { warn: jest.fn() }, stripeCaptureService: { cancelOrderPaymentIntent: jest.fn() } };
    const order = { id: 'o-1', order_number: 'N', payment_source: 'credit_card', payment_status: 'authorized' };
    self.stripeCaptureService.cancelOrderPaymentIntent.mockResolvedValueOnce({ success: false, message: 'x' });
    await expect(real.call(self, order)).resolves.toEqual({ ok: false, message: 'x' });
    self.stripeCaptureService.cancelOrderPaymentIntent.mockResolvedValueOnce({ success: false, skipped: true });
    await expect(real.call(self, order)).resolves.toEqual({ ok: true });
    self.stripeCaptureService.cancelOrderPaymentIntent.mockResolvedValueOnce({ success: true });
    await expect(real.call(self, order)).resolves.toEqual({ ok: true });
  });

  it.each(['picked_up', 'in_transit', 'out_for_delivery'])('refused once the agent holds the goods (%s): 409 ORDER_ALREADY_PICKED_UP, nothing written', async (status) => {
    const { svc, calls, events } = service(status);
    const err = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(409);
    expect((err as HttpException).getResponse()).toMatchObject({ error: 'ORDER_ALREADY_PICKED_UP' });
    expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(events).toEqual([]);
  });

  it('without a resolvable admin user nothing is cancelled', async () => {
    const { svc } = service('pending');
    svc.hasuraUserService.getUser.mockRejectedValue(new Error('no user'));
    await expect(svc.adminFullRefundCancel('o-1', 'r')).rejects.toBeInstanceOf(HttpException);
    expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
  });
});

describe('POST /admin/orders/:orderId/full-refund-cancel', () => {
  const handler = AdminOrdersController.prototype.fullRefundCancel;
  const guardFor = (access: { isSuperuser?: boolean; roles?: string[]; permissions?: string[] }) => {
    const guard = new AdminAuthGuard(
      new Reflector(),
      { getUser: jest.fn(async () => ({ id: 'u-1' })) } as any,
      { isBusinessAdmin: jest.fn(async () => true) } as any,
      { getEffectiveAccess: jest.fn(async () => ({ isSuperuser: false, roles: [], permissions: [], ...access })) } as any
    );
    const ctx = { getHandler: () => handler, getClass: () => AdminOrdersController, switchToHttp: () => ({ getRequest: () => ({}) }) } as any;
    return guard.canActivate(ctx);
  };

  it('auth: superuser or platform.financial.refunds only; the controller-wide orders permission is not enough', async () => {
    await expect(guardFor({ isSuperuser: true })).resolves.toBe(true);
    await expect(guardFor({ permissions: ['platform.financial.refunds'] })).resolves.toBe(true);
    await expect(guardFor({ permissions: ['platform.orders.cross_business'] })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guardFor({ roles: ['support'] })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  const controller = (cancel: jest.Mock) => {
    const ctrl = Object.create(AdminOrdersController.prototype) as any;
    ctrl.geo = { require: jest.fn(async () => ({ all: true })), assertOrder: jest.fn(async () => undefined) };
    ctrl.ordersService = { adminFullRefundCancel: cancel };
    ctrl.hasuraUserService = { getUser: jest.fn(async () => ({ id: 'admin-1' })) };
    ctrl.orderEventsService = {
      recordEvent: jest.fn(async () => undefined),
      recordEventStrict: jest.fn(async () => undefined),
    };
    ctrl.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    return ctrl;
  };

  it('geo-scopes on the refunds permission and audit-logs the intervention (actor, reason, previous status) after success', async () => {
    const ctrl = controller(jest.fn(async () => ({ success: true, previousStatus: 'ready_for_pickup', cancellationFee: 0, depositRefund: { status: 'failed', message: 'consumed' }, failedSteps: [] })));
    await ctrl.fullRefundCancel('o-1', { reason: 'QA leftover' });
    expect(ctrl.geo.require).toHaveBeenCalledWith('platform.financial.refunds');
    expect(ctrl.geo.assertOrder).toHaveBeenCalledWith({ all: true }, 'o-1');
    expect(ctrl.orderEventsService.recordEventStrict).toHaveBeenCalledWith({
      orderId: 'o-1',
      eventType: 'admin_intervention',
      actorType: 'support',
      actorId: 'admin-1',
      payload: { action: 'full_refund_cancel', reason: 'QA leftover', previousStatus: 'ready_for_pickup', cancellationFee: 0, depositRefund: { status: 'failed', message: 'consumed' }, failedSteps: [] },
    });
    // #626 B1: the deposit outcome is on the audit event itself.
    expect(ctrl.orderEventsService.recordEventStrict.mock.calls[0][0].payload).toHaveProperty('depositRefund', { status: 'failed', message: 'consumed' });
    expect(ctrl.orderEventsService.recordEvent).not.toHaveBeenCalled();
  });

  it('QA A4: PII in the reason is masked before it is stored (service) or audited', async () => {
    const ctrl = controller(jest.fn(async () => ({ success: true, previousStatus: 'confirmed', cancellationFee: 0 })));
    await ctrl.fullRefundCancel('o-1', { reason: 'client jane.doe@mail.com +237 670 123 456 asked' });
    const stored = ctrl.ordersService.adminFullRefundCancel.mock.calls[0][1];
    expect(stored).toBe('client [REDACTED_EMAIL] [REDACTED_PHONE] asked');
    expect(ctrl.orderEventsService.recordEventStrict.mock.calls[0][0].payload.reason).toBe(stored);
  });

  it('the audit write failing does not fail the (already done) cancel; it alerts with who/what/why', async () => {
    const ctrl = controller(jest.fn(async () => ({ success: true, previousStatus: 'confirmed', cancellationFee: 0 })));
    ctrl.orderEventsService.recordEventStrict.mockRejectedValueOnce(new Error('hasura down'));
    await expect(ctrl.fullRefundCancel('o-1', { reason: 'cleanup' })).resolves.toMatchObject({ success: true });
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(),
      'admin_full_refund_cancel_audit_failed',
      expect.stringContaining('hasura down'),
      expect.objectContaining({ orderId: 'o-1', actorId: 'admin-1', previousStatus: 'confirmed', reason: 'cleanup' })
    );
    // An actor lookup failure is caught the same way.
    (reportMoneyAnomaly as jest.Mock).mockClear();
    ctrl.hasuraUserService.getUser.mockRejectedValueOnce(new Error('no ctx'));
    await expect(ctrl.fullRefundCancel('o-1', { reason: 'cleanup' })).resolves.toMatchObject({ success: true });
    expect(reportMoneyAnomaly).toHaveBeenCalledTimes(1);
  });

  it('a refused cancel (409 / out of scope) writes no audit event', async () => {
    const ctrl = controller(jest.fn(async () => Promise.reject(new HttpException('moved', 409))));
    await expect(ctrl.fullRefundCancel('o-1', { reason: 'x' })).rejects.toBeInstanceOf(HttpException);
    expect(ctrl.orderEventsService.recordEventStrict).not.toHaveBeenCalled();
    ctrl.geo.assertOrder.mockRejectedValueOnce(new HttpException('Access denied', 403));
    await expect(ctrl.fullRefundCancel('o-1', { reason: 'x' })).rejects.toBeInstanceOf(HttpException);
    expect(ctrl.ordersService.adminFullRefundCancel).toHaveBeenCalledTimes(1);
  });
});

describe('handleDepositOnCancellation outcome (QA A2)', () => {
  const svcWith = (refund: jest.Mock) => {
    const svc = Object.create(OrdersService.prototype) as any;
    svc.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    svc.depositCalculationService = { isAfterRefundLockPoint: jest.fn(() => false) };
    svc.depositRefundService = { refundDeposit: refund };
    return svc;
  };
  const paid = { id: 'o-1', deposit_status: 'paid', deposit_amount: 500, fulfillment_method: 'delivery' };
  it('system cancel: refused -> failed with message/code; threw -> failed; ok -> refunded; no deposit -> none', async () => {
    let svc = svcWith(jest.fn(async () => ({ success: false, message: 'consumed', errorCode: 'C' })));
    await expect(svc.handleDepositOnCancellation(paid, 'o-1', 'confirmed', 'system')).resolves.toEqual({ status: 'failed', message: 'consumed', errorCode: 'C' });
    svc = svcWith(jest.fn(async () => { throw new Error('boom'); }));
    await expect(svc.handleDepositOnCancellation(paid, 'o-1', 'confirmed', 'system')).resolves.toEqual({ status: 'failed', message: 'boom' });
    svc = svcWith(jest.fn(async () => ({ success: true })));
    await expect(svc.handleDepositOnCancellation(paid, 'o-1', 'confirmed', 'system')).resolves.toEqual({ status: 'refunded' });
    await expect(svc.handleDepositOnCancellation({ ...paid, deposit_status: 'none' }, 'o-1', 'confirmed', 'system')).resolves.toEqual({ status: 'none' });
  });

  it('client cancel before lock reports accurately: refunded / failed (refused or threw)', async () => {
    let svc = svcWith(jest.fn(async () => ({ success: true })));
    await expect(svc.handleDepositOnCancellation(paid, 'o-1', 'confirmed', 'client')).resolves.toEqual({ status: 'refunded' });
    svc = svcWith(jest.fn(async () => ({ success: false, message: 'nope', errorCode: 'X' })));
    await expect(svc.handleDepositOnCancellation(paid, 'o-1', 'confirmed', 'client')).resolves.toEqual({ status: 'failed', message: 'nope', errorCode: 'X' });
    svc = svcWith(jest.fn(async () => { throw new Error('t'); }));
    await expect(svc.handleDepositOnCancellation(paid, 'o-1', 'confirmed', 'client')).resolves.toEqual({ status: 'failed', message: 't' });
  });
});

describe('OrderEventsService.recordEventStrict (QA A3)', () => {
  it('throws on an insert failure while recordEvent swallows it', async () => {
    const { OrderEventsService } = await import('./order-events.service');
    const hasura = { executeMutation: jest.fn(async () => { throw new Error('down'); }) };
    const ev = new OrderEventsService(hasura as any);
    const p = { orderId: 'o', eventType: 'admin_intervention' as any, actorType: 'support' as any };
    await expect(ev.recordEventStrict(p)).rejects.toThrow('down');
    await expect(ev.recordEvent(p)).resolves.toBeUndefined();
  });
});
