/**
 * Admin full-refund cancel (ops cleanup): superuser / financial-refunds admin only,
 * cancel as `system` (no cancellation fee; the order.cancelled Lambda releases the
 * client and agent holds under per-order idempotency keys), compare-and-set so it
 * runs exactly once, refused after pickup, and audit-logged only on success.
 */
jest.mock('../notifications/notifications.service', () => ({ NotificationsService: class NotificationsService {} }));
jest.mock('../common/utils/money-alert.util', () => ({ reportMoneyAnomaly: jest.fn() }));
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

type Order = { id: string; current_status: string; order_items: unknown[] };

function service(start: string) {
  const db = { status: start };
  const svc = Object.create(OrdersService.prototype) as any;
  const calls: string[] = [];
  const order: Order = { id: 'o-1', current_status: start, order_items: [] };
  svc.getOrderDetails = jest.fn(async () => ({ ...order, current_status: db.status }));
  svc.hasuraUserService = { getUser: jest.fn(async () => ({ id: 'admin-1' })) };
  // Mirrors OrderStatusService: the cancel is a compare-and-set on expectedFromStatus.
  svc.orderStatusService = {
    updateOrderStatus: jest.fn(async (_id: string, to: string, opts: any) => {
      if (db.status === 'cancelled' || db.status !== opts.expectedFromStatus) {
        throw new HttpException('Order status already changed. Please refresh and try again.', 409);
      }
      db.status = to;
      return { id: 'o-1', current_status: to };
    }),
  };
  for (const m of ['releaseStripeAuthorizationIfNeeded', 'supersedePendingOrderTxsOnCancel', 'persistCancellationMetadata', 'createStatusHistoryEntry', 'runOrderCancellationSideEffects']) {
    svc[m] = jest.fn(async () => void calls.push(m));
  }
  svc.runOrderCancellationSideEffects = jest.fn(async () => {
    calls.push('runOrderCancellationSideEffects');
    return { status: 'refunded' };
  });
  svc.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  return { svc, db, calls };
}

describe('OrdersService.adminFullRefundCancel', () => {
  it('cancels as system (no fee), with the reason on the metadata and history, and runs the refund side effects once', async () => {
    const { svc, db } = service('ready_for_pickup');
    await expect(svc.adminFullRefundCancel('o-1', 'QA leftover')).resolves.toMatchObject({ success: true, previousStatus: 'ready_for_pickup', cancellationFee: 0 });
    expect(db.status).toBe('cancelled');
    expect(svc.orderStatusService.updateOrderStatus).toHaveBeenCalledWith('o-1', 'cancelled', { viaCancelEndpoint: true, viaSystem: true, expectedFromStatus: 'ready_for_pickup' });
    expect(svc.persistCancellationMetadata).toHaveBeenCalledWith('o-1', 'system', 'Admin full refund: QA leftover');
    expect(svc.createStatusHistoryEntry).toHaveBeenCalledWith('o-1', 'cancelled', expect.stringContaining('full refund'), 'system', 'admin-1', 'Admin full refund: QA leftover');
    // cancelled_by=system: the Lambda never charges a fee for it and releases client + agent holds by key.
    expect(svc.runOrderCancellationSideEffects).toHaveBeenCalledWith(expect.objectContaining({ id: 'o-1' }), 'o-1', 'ready_for_pickup', 'system', 'Admin full refund: QA leftover');
    expect(svc.releaseStripeAuthorizationIfNeeded).toHaveBeenCalledTimes(1);
  });

  it('two concurrent calls: one wins, the other gets 409 before any side effect (exactly once)', async () => {
    const { svc, calls } = service('assigned_to_agent');
    const results = await Promise.allSettled([svc.adminFullRefundCancel('o-1', 'r1'), svc.adminFullRefundCancel('o-1', 'r2')]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((lost.reason as HttpException).getStatus()).toBe(409);
    expect(calls.filter((c) => c === 'runOrderCancellationSideEffects')).toHaveLength(1);
    expect(calls.filter((c) => c === 'releaseStripeAuthorizationIfNeeded')).toHaveLength(1);
  });

  it('a second call after the cancel is refused (terminal status) with nothing re-run', async () => {
    const { svc, calls } = service('confirmed');
    await svc.adminFullRefundCancel('o-1', 'r');
    calls.length = 0;
    await expect(svc.adminFullRefundCancel('o-1', 'r')).rejects.toBeInstanceOf(HttpException);
    expect(calls).toEqual([]);
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
    (reportMoneyAnomaly as jest.Mock).mockClear();
    const { svc, db, calls } = service(status);
    const res = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    if (allowed) {
      expect(res).toMatchObject({ success: true });
      expect(db.status).toBe('cancelled');
    } else {
      expect(res).toBeInstanceOf(HttpException);
      expect([400, 409]).toContain((res as HttpException).getStatus());
      expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
    }
  });

  it.each(['awaiting_shipment', 'shipped', 'in_delivery'])('QA A1: shipping %s is refused with 409 (goods have left)', async (status) => {
    const { svc } = service(status);
    const err = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(409);
  });

  it('QA A2: a deposit refund that failed or was refused is reported (alert + depositRefund), never claimed as a full refund', async () => {
    (reportMoneyAnomaly as jest.Mock).mockClear();
    const { svc } = service('confirmed');
    svc.runOrderCancellationSideEffects.mockResolvedValueOnce({ status: 'failed', message: 'Deposit already consumed', errorCode: 'DEPOSIT_CONSUMED' });
    const res = await svc.adminFullRefundCancel('o-1', 'r');
    expect(res.depositRefund).toEqual({ status: 'failed', message: 'Deposit already consumed', errorCode: 'DEPOSIT_CONSUMED' });
    expect(res.message).toMatch(/DEPOSIT REFUND FAILED/);
    expect(res.message).not.toMatch(/with a full refund/);
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(),
      'admin_full_refund_cancel_deposit_refund_failed',
      expect.stringContaining('Deposit already consumed'),
      expect.objectContaining({ orderId: 'o-1', errorCode: 'DEPOSIT_CONSUMED' })
    );
  });

  it.each([{ status: 'refunded' }, { status: 'none' }])('QA A2: deposit %o -> no alert, full refund message', async (outcome) => {
    (reportMoneyAnomaly as jest.Mock).mockClear();
    const { svc } = service('confirmed');
    svc.runOrderCancellationSideEffects.mockResolvedValueOnce(outcome);
    const res = await svc.adminFullRefundCancel('o-1', 'r');
    expect(res.depositRefund).toEqual(outcome);
    expect(res.message).toMatch(/full refund to the client wallet/);
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
  });

  it.each(['releaseStripeAuthorizationIfNeeded', 'supersedePendingOrderTxsOnCancel', 'persistCancellationMetadata', 'createStatusHistoryEntry', 'runOrderCancellationSideEffects'])(
    'a post-cancel failure in %s alerts and returns a clear partial-failure response (no 500); later steps still run',
    async (m) => {
      (reportMoneyAnomaly as jest.Mock).mockClear();
      const { svc, db } = service('confirmed');
      svc[m].mockRejectedValueOnce(new Error('boom'));
      const res = await svc.adminFullRefundCancel('o-1', 'r');
      expect(db.status).toBe('cancelled');
      expect(res).toMatchObject({ success: true, partialFailure: true });
      expect(res.failedSteps).toHaveLength(1);
      // D2: no raw internal error text in the response; the detail is in the alert.
      expect(res.failedSteps[0].error).toBe('Step failed; details are in the logs (alerted)');
      expect(JSON.stringify(res)).not.toContain('boom');
      expect(res.message).toMatch(/FAILED and needs manual follow-up/);
      expect(reportMoneyAnomaly).toHaveBeenCalledWith(expect.anything(), 'admin_full_refund_cancel_step_failed', expect.stringContaining('boom'), expect.objectContaining({ orderId: 'o-1' }));
      expect(svc.runOrderCancellationSideEffects).toHaveBeenCalledTimes(1);
      if (m === 'runOrderCancellationSideEffects') expect(res.depositRefund.status).toBe('failed');
    }
  );

  it('#626 D1: a Stripe void that fails WITHOUT throwing ({ ok: false }) is a failed step, alerted, the rest still runs', async () => {
    (reportMoneyAnomaly as jest.Mock).mockClear();
    const { svc } = service('confirmed');
    svc.releaseStripeAuthorizationIfNeeded.mockResolvedValueOnce({ ok: false, message: 'pi secret detail' });
    const res = await svc.adminFullRefundCancel('o-1', 'r');
    expect(res).toMatchObject({ success: true, partialFailure: true });
    expect(res.failedSteps).toEqual([{ step: 'releaseStripeAuthorization', error: 'Step failed; details are in the logs (alerted)' }]);
    expect(JSON.stringify(res)).not.toContain('pi secret detail');
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(), 'admin_full_refund_cancel_step_failed', expect.stringContaining('pi secret detail'),
      expect.objectContaining({ step: 'releaseStripeAuthorization' })
    );
    expect(svc.runOrderCancellationSideEffects).toHaveBeenCalledTimes(1);
  });

  it.each([[{ ok: true }], [undefined]])('#626 D1: a void result %o is not a failure', async (r) => {
    const { svc } = service('confirmed');
    svc.releaseStripeAuthorizationIfNeeded.mockResolvedValueOnce(r);
    await expect(svc.adminFullRefundCancel('o-1', 'r')).resolves.toMatchObject({ partialFailure: false, failedSteps: [] });
  });

  it('no failure -> partialFailure false, failedSteps empty', async () => {
    const { svc } = service('confirmed');
    await expect(svc.adminFullRefundCancel('o-1', 'r')).resolves.toMatchObject({ partialFailure: false, failedSteps: [] });
  });

  it.each(['picked_up', 'in_transit', 'out_for_delivery'])('refused once the agent holds the goods (%s): 409, nothing written', async (status) => {
    const { svc, calls } = service(status);
    const err = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(409);
    expect((err as HttpException).getResponse()).toMatchObject({ error: 'ORDER_ALREADY_PICKED_UP' });
    expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it.each(['delivered', 'complete', 'cancelled', 'refunded'])('a %s order is refused (400) with nothing written', async (status) => {
    const { svc, calls } = service(status);
    const err = await svc.adminFullRefundCancel('o-1', 'r').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(400);
    expect(svc.orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
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
