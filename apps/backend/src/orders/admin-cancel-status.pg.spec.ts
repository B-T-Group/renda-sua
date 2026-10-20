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
import { ADMIN_PRE_PICKUP_CANCELLABLE_STATUSES, ADMIN_STATUS_OVERRIDE_VALUES } from './admin-order-status.util';

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

  const controller = (status: string, agentId: string | null = null) => {
    const cancel = jest.fn(async () => ({ success: true }));
    const ctrl = Object.create(AdminOrdersController.prototype) as any;
    ctrl.ordersService = {
      getOrderById: jest.fn(async () => ({ id: 'o-1', current_status: status, assigned_agent_id: agentId })),
      cancelOrderAsAdmin: cancel,
    };
    ctrl.geo = { require: jest.fn(async () => ({ all: true })), assertOrder: jest.fn(async () => undefined) };
    ctrl.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    ctrl.hasuraSystemService = { executeMutation: jest.fn(async () => ({ update_orders: { affected_rows: 1 } })) };
    ctrl.orderEventsService = { recordEvent: jest.fn(async () => undefined) };
    return { ctrl, cancel };
  };

  const service = (status: string) => {
    const svc = Object.create(OrdersService.prototype) as any;
    svc.getOrderDetails = jest.fn(async () => ({ id: 'o-1', current_status: status, order_items: [] }));
    svc.hasuraUserService = { getUser: jest.fn(async () => ({ id: 'admin-1' })) };
    svc.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    svc.releaseStripeAuthorizationIfNeeded = jest.fn(async () => undefined);
    svc.markOrderCancelledAsSystem = jest.fn(async () => ({ id: 'o-1', current_status: 'cancelled' }));
    svc.persistCancellationMetadata = jest.fn(async () => undefined);
    svc.createStatusHistoryEntry = jest.fn(async () => undefined);
    svc.updateReservedQuantities = jest.fn(async () => undefined);
    svc.orderQueueService = { sendOrderCancelledMessage: jest.fn(async () => undefined) };
    // No progress row: a 'cancelled' order must be refused.
    svc.hasuraSystemService = {
      executeQuery: jest.fn(async () => ({ order_events: [] })),
      executeMutation: jest.fn(async () => ({ insert_order_events_one: { id: 'ev-1' }, update_order_events: { affected_rows: 1 } })),
    };
    return svc;
  };

  it('the enum has the shipping statuses and every allowlisted status exists in it', () => {
    expect(statuses.length).toBeGreaterThanOrEqual(24);
    expect(statuses).toEqual(expect.arrayContaining(['awaiting_shipment', 'shipped', 'in_delivery']));
    for (const s of ADMIN_PRE_PICKUP_CANCELLABLE_STATUSES) expect(statuses).toContain(s);
  });

  it('every status: only the pre-pickup allowlist cancels (controller and service); all others 409 (ORDER_ALREADY_CANCELLED / ORDER_ALREADY_PICKED_UP) with nothing released', async () => {
    const allowed = ['pending_payment', 'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned_to_agent'];
    const seen: Array<[string, boolean]> = [];
    for (const status of statuses) {
      const ok = allowed.includes(status);
      const { ctrl, cancel } = controller(status);
      const c = await ctrl.updateStatus('o-1', { status: 'cancelled', reason: 'r' }).catch((e: unknown) => e);
      const svc = service(status);
      const s = await svc.cancelOrderAsAdmin('o-1', 'r').catch((e: unknown) => e);
      if (ok) {
        expect(cancel).toHaveBeenCalledWith('o-1', 'r', status);
        expect(s).toMatchObject({ success: true, partialFailure: false });
      } else {
        if (status === 'cancelled') {
          // C4: the controller lets a retry through; the service (no incomplete marker) refuses it.
          expect(cancel).toHaveBeenCalledWith('o-1', 'r', 'cancelled');
        } else {
          expect(c).toBeInstanceOf(HttpException);
          expect((c as HttpException).getStatus()).toBe(409);
          expect((c as HttpException).getResponse()).toMatchObject({ error: 'ORDER_ALREADY_PICKED_UP' });
          expect(cancel).not.toHaveBeenCalled();
        }
        expect(s).toBeInstanceOf(HttpException);
        expect((s as HttpException).getStatus()).toBe(409);
        expect((s as HttpException).getResponse()).toMatchObject({ error: status === 'cancelled' ? 'ORDER_ALREADY_CANCELLED' : 'ORDER_ALREADY_PICKED_UP' });
        expect(svc.releaseStripeAuthorizationIfNeeded).not.toHaveBeenCalled();
        expect(svc.markOrderCancelledAsSystem).not.toHaveBeenCalled();
        expect(svc.updateReservedQuantities).not.toHaveBeenCalled();
      }
      seen.push([status, ok]);
    }
    expect(seen.filter(([, ok]) => ok).map(([s]) => s).sort()).toEqual([...allowed].sort());
  });

  it('#627 C1: every (from x to) override pair over the real enum follows the explicit transition map', async () => {
    // Independent oracle: pre-pickup (not pending_payment) -> any operational target;
    // in_transit/out_for_delivery -> each other only; everything else -> nothing.
    const prePickup = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned_to_agent'];
    const enRoute = ['in_transit', 'out_for_delivery'];
    const targets = (ADMIN_STATUS_OVERRIDE_VALUES as readonly string[]).filter((t) => t !== 'cancelled');
    // I1: in_transit / out_for_delivery only with an assigned agent.
    const oracle = (from: string, to: string, agent: boolean) =>
      from !== to &&
      targets.includes(to) &&
      (agent || !enRoute.includes(to)) &&
      (prePickup.includes(from) || (enRoute.includes(from) && enRoute.includes(to)));
    let allowedPairs = 0;
    for (const agent of [true, false])
    for (const from of statuses) {
      for (const to of [...targets, ...statuses.filter((s) => !targets.includes(s) && s !== 'cancelled')]) {
        const { ctrl } = controller(from, agent ? 'agent-1' : null);
        const res = await ctrl.updateStatus('o-1', { status: to, notes: 'n' }).catch((e: unknown) => e);
        if (oracle(from, to, agent)) {
          allowedPairs++;
          expect([agent, from, to, res]).toEqual([agent, from, to, expect.objectContaining({ success: true })]);
        } else {
          expect([agent, from, to, res instanceof HttpException && (res as HttpException).getStatus()]).toEqual([agent, from, to, 400]);
          expect(ctrl.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
        }
      }
    }
    // No backward move out of any status outside the pre-pickup allowlist into it.
    for (const from of statuses.filter((s) => !(ADMIN_PRE_PICKUP_CANCELLABLE_STATUSES as readonly string[]).includes(s))) {
      for (const to of prePickup) {
        const { ctrl } = controller(from);
        await expect(ctrl.updateStatus('o-1', { status: to, notes: 'n' })).rejects.toBeInstanceOf(HttpException);
      }
    }
    // with agent: 5 pre-pickup x 6 targets + 2 en-route swaps; without: 5 x 4, no swaps.
    expect(allowedPairs).toBe(5 * 6 + 2 + 5 * 4);
  });
});
