/**
 * #627: PATCH /admin/orders/:id/status {cancelled} over EVERY public.order_status value,
 * read from the real enum in the rs_base template (read-only; nothing is written).
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=admin-cancel-status.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 */
jest.mock('../notifications/notifications.service', () => ({ NotificationsService: class NotificationsService {} }));
import { HttpException } from '@nestjs/common';
import { Client } from 'pg';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { ADMIN_PRE_PICKUP_CANCELLABLE_STATUSES } from './admin-order-status.util';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const suite = TEMPLATE ? describe : describe.skip;

suite('admin cancel allowlist vs the real order_status enum (#627)', () => {
  let statuses: string[] = [];

  beforeAll(async () => {
    const db = new Client({ database: TEMPLATE });
    await db.connect();
    try {
      const r = await db.query(`SELECT unnest(enum_range(NULL::order_status))::text AS s`);
      statuses = r.rows.map((x: { s: string }) => x.s);
    } finally {
      await db.end();
    }
  });

  const controller = (status: string) => {
    const cancel = jest.fn(async () => ({ success: true }));
    const ctrl = Object.create(AdminOrdersController.prototype) as any;
    ctrl.ordersService = { getOrderById: jest.fn(async () => ({ id: 'o-1', current_status: status })), cancelOrderAsAdmin: cancel };
    ctrl.geo = { require: jest.fn(async () => ({ all: true })), assertOrder: jest.fn(async () => undefined) };
    ctrl.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    return { ctrl, cancel };
  };

  const service = (status: string) => {
    const svc = Object.create(OrdersService.prototype) as any;
    svc.getOrderDetails = jest.fn(async () => ({ id: 'o-1', current_status: status, order_items: [] }));
    svc.hasuraUserService = { getUser: jest.fn(async () => ({ id: 'admin-1' })) };
    svc.releaseStripeAuthorizationIfNeeded = jest.fn(async () => undefined);
    svc.markOrderCancelledAsSystem = jest.fn(async () => ({ id: 'o-1', current_status: 'cancelled' }));
    svc.finishAdminCancellation = jest.fn(async () => undefined);
    return svc;
  };

  it('the enum has the shipping statuses and every allowlisted status exists in it', () => {
    expect(statuses.length).toBeGreaterThanOrEqual(24);
    expect(statuses).toEqual(expect.arrayContaining(['awaiting_shipment', 'shipped', 'in_delivery']));
    for (const s of ADMIN_PRE_PICKUP_CANCELLABLE_STATUSES) expect(statuses).toContain(s);
  });

  it('every status: only the pre-pickup allowlist cancels (controller and service); all others 400 with nothing released', async () => {
    const allowed = ['pending_payment', 'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned_to_agent'];
    const seen: Array<[string, boolean]> = [];
    for (const status of statuses) {
      const ok = allowed.includes(status);
      const { ctrl, cancel } = controller(status);
      const c = await ctrl.updateStatus('o-1', { status: 'cancelled', reason: 'r' }).catch((e: unknown) => e);
      const svc = service(status);
      const s = await svc.cancelOrderAsAdmin('o-1', 'r').catch((e: unknown) => e);
      if (ok) {
        expect(cancel).toHaveBeenCalledWith('o-1', 'r');
        expect(s).toMatchObject({ success: true });
      } else {
        expect(c).toBeInstanceOf(HttpException);
        expect((c as HttpException).getStatus()).toBe(400);
        expect(cancel).not.toHaveBeenCalled();
        expect(s).toBeInstanceOf(HttpException);
        expect((s as HttpException).getStatus()).toBe(400);
        expect(svc.releaseStripeAuthorizationIfNeeded).not.toHaveBeenCalled();
        expect(svc.markOrderCancelledAsSystem).not.toHaveBeenCalled();
      }
      seen.push([status, ok]);
    }
    expect(seen.filter(([, ok]) => ok).map(([s]) => s).sort()).toEqual([...allowed].sort());
  });
});
