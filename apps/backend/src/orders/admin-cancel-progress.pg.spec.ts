/**
 * #627 C7: the admin-cancel progress CAS against a real Postgres order_events table.
 * Concurrent retries run on separate connections; exactly one claims the lease and
 * the failed step runs once.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=admin-cancel-progress.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 */
jest.mock('../notifications/notifications.service', () => ({ NotificationsService: class NotificationsService {} }));
jest.mock('../common/utils/money-alert.util', () => ({ reportMoneyAnomaly: jest.fn() }));
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Client, Pool } from 'pg';
import { OrdersService } from './orders.service';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const suite = TEMPLATE ? describe : describe.skip;
const op = (q: string) => /(?:query|mutation) (\w+)/.exec(q)?.[1] ?? '?';

suite('admin cancel progress CAS on real Postgres (#627 C7)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_admin_cancel_${process.pid}_${Date.now()}`;
  let admin: Client;
  let pool: Pool;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    pool = new Pool({ database: dbName, max: 10 });
    pool.on('error', () => undefined);
    // Isolated scratch DB: no orders row is needed for these event rows.
    await pool.query(`ALTER TABLE order_events DROP CONSTRAINT IF EXISTS order_events_order_id_fkey`);
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });
  beforeEach(() => {
    for (const k of ['log', 'warn', 'error'] as const) jest.spyOn(Logger.prototype, k).mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  /** The three Hasura operations, as the SQL Hasura compiles them to. */
  const hasura = {
    executeQuery: async (q: string, v: any) => {
      if (op(q) !== 'AdminCancelProgress') throw new Error(op(q));
      const r = await pool.query(
        `SELECT id, payload FROM order_events WHERE order_id = $1 AND event_type = $2 ORDER BY created_at ASC LIMIT 1`,
        [v.orderId, v.type]
      );
      return { order_events: r.rows };
    },
    executeMutation: async (q: string, v: any) => {
      if (op(q) === 'InsertAdminCancelProgress') {
        const r = await pool.query(
          `INSERT INTO order_events (order_id, event_type, actor_type, actor_id, payload) VALUES ($1, $2, 'support', NULL, $3) RETURNING id`,
          [v.orderId, v.type, v.payload]
        );
        return { insert_order_events_one: r.rows[0] };
      }
      if (op(q) === 'CasAdminCancelProgress') {
        const r = await pool.query(`UPDATE order_events SET payload = $3 WHERE id = $1 AND payload @> $2`, [v.id, v.expect, v.payload]);
        return { update_order_events: { affected_rows: r.rowCount } };
      }
      if (op(q) === 'DeleteAdminCancelProgress') {
        const r = await pool.query(`DELETE FROM order_events WHERE id = $1 AND event_type = $3 AND payload @> $2`, [v.id, v.expect, v.type]);
        return { delete_order_events: { affected_rows: r.rowCount } };
      }
      throw new Error(op(q));
    },
  };

  function build(orderId: string) {
    const order: any = { id: orderId, order_number: 'ORD-PG', current_status: 'confirmed', order_items: [] };
    const svc = Object.create(OrdersService.prototype) as any;
    svc.logger = new Logger('OrdersService');
    svc.hasuraSystemService = hasura;
    svc.hasuraUserService = { getUser: async () => ({ id: null }) };
    svc.getOrderDetails = async () => ({ ...order });
    // A compare-and-set like OrderStatusService (expectedFromStatus), with a yield.
    svc.orderStatusService = {
      updateOrderStatus: jest.fn(async (_id: string, to: string, o: any) => {
        await new Promise((r) => setTimeout(r, 5));
        if (order.current_status !== o.expectedFromStatus) throw new HttpException('Order status already changed', HttpStatus.CONFLICT);
        order.current_status = to;
        return { ...order };
      }),
    };
    svc.releaseStripeAuthorizationIfNeeded = async () => ({ ok: true });
    svc.persistCancellationMetadata = async () => undefined;
    svc.createStatusHistoryEntry = async () => undefined;
    svc.updateReservedQuantities = jest.fn(async () => undefined);
    svc.depositRefundService = { refundDeposit: async () => ({ success: true }) };
    const enqueue = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 20)); // hold the lease while the others try
    });
    svc.orderQueueService = { sendOrderCancelledMessage: enqueue };
    return { svc, enqueue };
  }

  it('enqueue fails; 6 concurrent retries: exactly one resumes, the rest 409; enqueue runs once more; stock never twice', async () => {
    for (let round = 0; round < 3; round++) {
      const orderId = `7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4e${String(round).padStart(2, '0')}`;
      const w = build(orderId);
      w.enqueue.mockRejectedValueOnce(new Error('sqs'));
      const first: any = await w.svc.cancelOrderAsAdmin(orderId, 'orig');
      expect(first.failedSteps).toEqual(['enqueueOrderCancelled']);
      const res = await Promise.all(
        Array.from({ length: 6 }, (_, i) => w.svc.cancelOrderAsAdmin(orderId, `r${i}`).catch((e: unknown) => e))
      );
      const ok = res.filter((r: any) => r?.success === true);
      const conflict = res.filter((r) => r instanceof HttpException && r.getStatus() === HttpStatus.CONFLICT);
      expect([ok.length, conflict.length]).toEqual([1, 5]);
      expect(ok[0]).toMatchObject({ resumed: true, failedSteps: [] });
      expect(w.enqueue).toHaveBeenCalledTimes(2);
      expect(w.svc.updateReservedQuantities).toHaveBeenCalledTimes(1);
      const row = (await pool.query(`SELECT payload FROM order_events WHERE order_id = $1`, [orderId])).rows;
      expect(row).toHaveLength(1);
      expect(Object.values(row[0].payload.steps).every((s) => s === 'done')).toBe(true);
      expect(row[0].payload.leaseOwner).toBeNull();
    }
  });

  it('QA #642 M1: 6 concurrent first cancels: one wins, the losers delete their rows; one row, stock once', async () => {
    const orderId = '7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4f01';
    const w = build(orderId);
    const res = await Promise.all(
      Array.from({ length: 6 }, (_, i) => w.svc.cancelOrderAsAdmin(orderId, `c${i}`, 'confirmed').catch((e: unknown) => e))
    );
    const ok = res.filter((r: any) => r?.success === true);
    expect(ok).toHaveLength(1);
    expect(res.filter((r) => r instanceof HttpException && r.getStatus() === HttpStatus.CONFLICT)).toHaveLength(5);
    expect(w.svc.updateReservedQuantities).toHaveBeenCalledTimes(1);
    const rows = (await pool.query(`SELECT payload FROM order_events WHERE order_id = $1`, [orderId])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ statusCancelled: true, leaseOwner: null });
  });

  it('QA #642 M1: the delete is guarded on the version (a row someone wrote since is kept)', async () => {
    const { deleteAdminCancelProgress } = await import('./admin-cancel-progress');
    const orderId = '7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4f02';
    const r = await pool.query(
      `INSERT INTO order_events (order_id, event_type, actor_type, payload) VALUES ($1, 'admin_cancel_progress', 'support', '{"version":2}') RETURNING id`,
      [orderId]
    );
    const id = r.rows[0].id;
    await expect(deleteAdminCancelProgress(hasura as any, { id, payload: { version: 1 } } as any)).resolves.toBe(false);
    expect((await pool.query(`SELECT 1 FROM order_events WHERE id = $1`, [id])).rowCount).toBe(1);
    await expect(deleteAdminCancelProgress(hasura as any, { id, payload: { version: 2 } } as any)).resolves.toBe(true);
    expect((await pool.query(`SELECT 1 FROM order_events WHERE id = $1`, [id])).rowCount).toBe(0);
  });
});
