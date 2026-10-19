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
    ctrl.hasuraSystemService = { executeMutation: jest.fn(async () => ({ insert_order_events_one: { id: 'ev-1' } })) };
    ctrl.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    return ctrl;
  };

  it('geo-scopes on the refunds permission and audit-logs the intervention (actor, reason, previous status) after success', async () => {
    const ctrl = controller(jest.fn(async () => ({ success: true, previousStatus: 'ready_for_pickup', cancellationFee: 0 })));
    await ctrl.fullRefundCancel('o-1', { reason: 'QA leftover' });
    expect(ctrl.geo.require).toHaveBeenCalledWith('platform.financial.refunds');
    expect(ctrl.geo.assertOrder).toHaveBeenCalledWith({ all: true }, 'o-1');
    expect(ctrl.hasuraSystemService.executeMutation).toHaveBeenCalledWith(expect.stringContaining('event_type: "admin_intervention"'), {
      orderId: 'o-1',
      actorId: 'admin-1',
      payload: { action: 'full_refund_cancel', reason: 'QA leftover', previousStatus: 'ready_for_pickup', cancellationFee: 0 },
    });
    expect(ctrl.hasuraSystemService.executeMutation.mock.calls[0][0]).toContain('actor_type: "support"');
  });

  it('the audit write failing does not fail the (already done) cancel; it alerts with who/what/why', async () => {
    const ctrl = controller(jest.fn(async () => ({ success: true, previousStatus: 'confirmed', cancellationFee: 0 })));
    ctrl.hasuraSystemService.executeMutation.mockRejectedValueOnce(new Error('hasura down'));
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
    expect(ctrl.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    ctrl.geo.assertOrder.mockRejectedValueOnce(new HttpException('Access denied', 403));
    await expect(ctrl.fullRefundCancel('o-1', { reason: 'x' })).rejects.toBeInstanceOf(HttpException);
    expect(ctrl.ordersService.adminFullRefundCancel).toHaveBeenCalledTimes(1);
  });
});
