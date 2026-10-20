/**
 * Atomic agent hold releases against a real Postgres ledger: the completion
 * (moveDeliveryLedger), drop, and failed-delivery (agent / item / client fault)
 * paths all release through release_agent_order_hold, so with the stranded-hold
 * reconciler racing, or a path retried, a hold is credited once and never more than
 * the net held for the order.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=agent-hold-release-paths.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 */
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));
import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client, Pool } from 'pg';
import { AccountsService } from '../accounts/accounts.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { FailedDeliveriesService } from './failed-deliveries.service';
import { OrderReassignmentService } from './order-reassignment.service';
import { OrdersService } from './orders.service';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const suite = TEMPLATE ? describe : describe.skip;
const op = (q: string) => /(?:query|mutation) (\w+)/.exec(q)?.[1] ?? '?';

/** The ledger slice of HasuraSystemService, as SQL (as in the #622 stranded-hold PG spec). */
function pgHasura(
  pool: Pool,
  mem: { events: any[]; assigned: () => string | null; orderNumber: string }
) {
  const executeQuery = async (
    q: string,
    v: Record<string, any>
  ): Promise<any> => {
    switch (op(q)) {
      case 'GetAccountById':
        return {
          accounts_by_pk:
            (
              await pool.query(`SELECT * FROM accounts WHERE id = $1`, [
                v.accountId,
              ])
            ).rows[0] ?? null,
        };
      case 'FindTransactionByIdempotencyKey':
        return {
          account_transactions: (
            await pool.query(
              `SELECT id, amount, idempotency_key FROM account_transactions WHERE idempotency_key = ANY($1)`,
              [v.keys]
            )
          ).rows,
        };
      case 'HasAccountTransaction':
        return {
          account_transactions: (
            await pool.query(
              `SELECT id FROM account_transactions WHERE account_id = $1 AND transaction_type = $2 AND reference_id = $3 LIMIT 1`,
              [v.accountId, v.transactionType, v.referenceId]
            )
          ).rows,
        };
      case 'AgentHoldLedger': {
        // One statement: both lists from one snapshot, as Hasura compiles a query.
        const r = await pool.query(
          `SELECT
             coalesce((SELECT json_agg(json_build_object('amount', amount)) FROM account_transactions
                        WHERE account_id = $1 AND reference_id = $2 AND transaction_type = 'hold'), '[]') AS holds,
             coalesce((SELECT json_agg(json_build_object('amount', amount)) FROM account_transactions
                        WHERE account_id = $1 AND reference_id = $2 AND transaction_type = 'release'), '[]') AS releases`,
          [v.accountId, v.orderId]
        );
        return r.rows[0];
      }
      case 'StrandedAgentHolds':
        return {
          order_events: mem.events
            .filter(
              (e) =>
                e.event_type === 'agent_hold_stranded' &&
                !('resolvedAt' in e.payload)
            )
            .map((e) => ({ ...e, payload: { ...e.payload } })),
        };
      case 'AgedOutStrandedAgentHolds':
        return { order_events: [] };
      case 'StrandedHoldOrder':
        return {
          orders_by_pk: {
            id: v.id,
            order_number: mem.orderNumber,
            assigned_agent_id: mem.assigned(),
          },
        };
      default:
        throw new Error(`unexpected query ${op(q)}`);
    }
  };
  const executeMutation = async (
    q: string,
    v: Record<string, any>
  ): Promise<any> => {
    switch (op(q)) {
      case 'ApplyBalanceDelta': {
        const w = v.where;
        const params: unknown[] = [
          w.id._eq,
          v.inc.available_balance,
          v.inc.withheld_balance,
          v.inc.cash_advance_balance,
        ];
        const guards: string[] = [];
        if (w.available_balance?._gte !== undefined)
          guards.push(
            `available_balance >= $${params.push(w.available_balance._gte)}`
          );
        if (w.withheld_balance?._gte !== undefined)
          guards.push(
            `withheld_balance >= $${params.push(w.withheld_balance._gte)}`
          );
        if (w.cash_advance_balance?._lte !== undefined)
          guards.push(
            `cash_advance_balance <= $${params.push(
              w.cash_advance_balance._lte
            )}`
          );
        const r = await pool.query(
          `UPDATE accounts SET available_balance = available_balance + $2, withheld_balance = withheld_balance + $3,
                  cash_advance_balance = cash_advance_balance + $4, updated_at = now()
            WHERE id = $1 ${guards.map((g) => `AND ${g}`).join(' ')}
            RETURNING available_balance, withheld_balance, cash_advance_balance`,
          params
        );
        return { update_accounts: { returning: r.rows } };
      }
      case 'InsertTransactionIdempotent': {
        const r = await pool.query(
          `INSERT INTO account_transactions (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ON CONSTRAINT account_transactions_idempotency_key_key DO NOTHING RETURNING id`,
          [
            v.accountId,
            v.amount,
            v.transactionType,
            v.memo,
            v.referenceId,
            v.idempotencyKey,
          ]
        );
        return { insert_account_transactions_one: r.rows[0] ?? null };
      }
      case 'ReleaseAgentOrderHold': {
        // As Hasura runs a tracked VOLATILE function: one statement, one transaction.
        const r = await pool.query(
          `SELECT id, amount::float AS amount FROM public.release_agent_order_hold($1, $2, $3, $4)`,
          [v.accountId, v.orderId, v.cap, v.memo]
        );
        return { release_agent_order_hold: r.rows };
      }
      case 'MarkStrandedAgentHold': {
        const e = mem.events.find((x) => x.id === v.id);
        if (e) e.payload = { ...e.payload, ...v.patch };
        return { update_order_events: { affected_rows: e ? 1 : 0 } };
      }
      case 'InsertTransaction': {
        const r = await pool.query(
          `INSERT INTO account_transactions (account_id, amount, transaction_type, memo, reference_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [v.accountId, v.amount, v.transactionType, v.memo, v.referenceId]
        );
        return { insert_account_transactions_one: r.rows[0] };
      }
      default:
        throw new Error(`unexpected mutation ${op(q)}`);
    }
  };
  const getAccount = async (userId: string, currency: string) =>
    (
      await pool.query(
        `SELECT * FROM accounts WHERE user_id = $1 AND currency = $2 AND business_location_id IS NULL`,
        [userId, currency]
      )
    ).rows[0] ?? null;
  return { executeQuery, executeMutation, getAccount };
}

suite('atomic agent hold releases on every path (real Postgres ledger)', () => {
  jest.setTimeout(90_000);
  const dbName = `rs_atomic_hold_${process.pid}_${Date.now()}`;
  let admin: Client;
  let pool: Pool;
  let seq = 0;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    pool = new Pool({ database: dbName, max: 10 });
    pool.on('error', () => undefined); // idle clients killed by the DROP ... WITH (FORCE)
    const ca = (
      await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cash_advance_balance'`
      )
    ).rowCount;
    if (!ca)
      await pool.query(
        `BEGIN;\n${readFileSync(join(MIGRATIONS, '1789840663276_payment_programs', 'up.sql'), 'utf8')}\nCOMMIT;`
      );
    await pool.query(
      `BEGIN;\n${readFileSync(join(MIGRATIONS, '20261019230000_release_agent_order_hold', 'up.sql'), 'utf8')}\nCOMMIT;`
    );
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (reportMoneyAnomaly as jest.Mock).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  async function setup(opening = 5_000) {
    const u = await pool.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('agent', 'A', 'T', $1) RETURNING id`,
      [`agent-ahr-${process.pid}-${++seq}@example.test`]
    );
    const userId = u.rows[0].id as string;
    const accountId = (
      await pool.query(
        `INSERT INTO accounts (user_id, currency, available_balance) VALUES ($1, 'XAF', $2) RETURNING id`,
        [userId, opening]
      )
    ).rows[0].id as string;
    const orderId = `8e2f4a52-3c1e-4b7e-9a51-0f6f2a1b${String(seq).padStart(4, '0')}`;
    const hasura = pgHasura(pool, { events: [], assigned: () => null, orderNumber: `ORD-${seq}` });
    const accounts = new AccountsService(hasura as any);
    const orders = Object.create(OrdersService.prototype) as any;
    orders.hasuraSystemService = hasura;
    orders.accountsService = accounts;
    orders.logger = new Logger('OrdersService');
    const failed = new FailedDeliveriesService({} as any, hasura as any, accounts, orders);
    const reconciler = new OrderReassignmentService(
      hasura as any,
      { recordEvent: jest.fn(), recordEventStrict: jest.fn() } as any,
      {} as any,
      {} as any,
      accounts
    );
    const order = {
      id: orderId,
      order_number: `ORD-${seq}`,
      currency: 'XAF',
      assigned_agent: { id: 'agent-1', user_id: userId, user: { id: userId } },
      client: { user_id: 'nobody', user: { id: 'nobody' } },
    } as any;
    const hold = async (amount = 700, reference = orderId) => {
      const r = await accounts.registerTransaction({
        accountId,
        amount,
        transactionType: 'hold',
        memo: 'claim',
        referenceId: reference,
      });
      expect(r.success).toBe(true);
    };
    const release = async (amount: number) => {
      const r = await accounts.registerTransaction({
        accountId,
        amount,
        transactionType: 'release',
        memo: 'earlier',
        referenceId: orderId,
        idempotencyKey: `earlier:${orderId}:${amount}`,
      });
      expect(r.success).toBe(true);
    };
    const balance = async () =>
      (
        await pool.query(
          `SELECT available_balance::float AS a, withheld_balance::float AS w FROM accounts WHERE id = $1`,
          [accountId]
        )
      ).rows[0] as { a: number; w: number };
    const released = async () =>
      Number(
        (
          await pool.query(
            `SELECT coalesce(sum(amount), 0)::float AS s FROM account_transactions WHERE account_id = $1 AND reference_id = $2 AND transaction_type = 'release'`,
            [accountId, orderId]
          )
        ).rows[0].s
      );
    const agentHold = { agent_hold_amount: 700, client_hold_amount: 0, delivery_fees: 0 };
    const paths: Record<string, () => Promise<unknown>> = {
      completion: () => orders.moveDeliveryLedger(order, agentHold, { skipClientLedgerMovements: true }),
      drop: () => orders.releaseDroppedAgentHold(order, accountId, 700),
      'failed-delivery agent fault': () => failed['resolveAgentFault']({ ...order, business: null }, agentHold),
      'failed-delivery item fault': () => failed['resolveItemFault'](order, agentHold, false),
      'failed-delivery client fault (agent leg)': () => failed['releaseAgentHold'](order, accountId, 700, 'client-fault'),
    };
    const reconcile = () =>
      (reconciler as any).releaseNetAgentHold(accountId, orderId, 'reconciled', { cap: 700 });
    return { accountId, orderId, hold, release, balance, released, paths, reconcile };
  }

  const PATHS = [
    'completion',
    'drop',
    'failed-delivery agent fault',
    'failed-delivery item fault',
    'failed-delivery client fault (agent leg)',
  ];

  it.each(PATHS)('%s: releases the hold once through the function; a retry credits nothing', async (path) => {
    const w = await setup();
    await w.hold(700);
    await w.hold(450, '9e2b1c33-4d5e-4f60-8a71-0b1c2d3e4f50'); // another order's hold on the same account
    expect(await w.balance()).toEqual({ a: 3_850, w: 1_150 });
    await w.paths[path]();
    expect(await w.balance()).toEqual({ a: 4_550, w: 450 });
    const rows = (
      await pool.query(
        `SELECT amount::float AS amount, idempotency_key FROM account_transactions WHERE account_id = $1 AND reference_id = $2 AND transaction_type = 'release'`,
        [w.accountId, w.orderId]
      )
    ).rows;
    expect(rows).toEqual([{ amount: 700, idempotency_key: `agent-hold-release:${w.orderId}:${w.accountId}:h1:r0` }]);
    // Retried path: the net is 0, nothing more (the old per-path keys would not stop a second path).
    await w.paths[path]();
    expect(await w.released()).toBe(700);
    expect(await w.balance()).toEqual({ a: 4_550, w: 450 });
  });

  it.each(PATHS)('%s: never more than the net (an earlier partial release of 300 leaves 400)', async (path) => {
    const w = await setup();
    await w.hold(700);
    await w.release(300);
    await w.paths[path]();
    // Old code released agent_hold_amount (700) here: 1000 released for a 700 hold.
    expect(await w.released()).toBe(700);
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
  });

  it.each(PATHS)('%s: never more than agent_hold_amount (cap) even when more is held for the order', async (path) => {
    const w = await setup();
    await w.hold(700);
    await w.hold(300); // a second hold on the same order (e.g. a re-claim); agent_hold_amount says 700
    await w.paths[path]();
    expect(await w.released()).toBe(700);
    expect(await w.balance()).toEqual({ a: 4_700, w: 300 });
  });

  it.each(PATHS)('%s racing the stranded-hold reconciler (and itself): credited exactly once', async (path) => {
    for (let round = 0; round < 4; round++) {
      const w = await setup();
      await w.hold(700);
      await w.hold(450, '9e2b1c33-4d5e-4f60-8a71-0b1c2d3e4f50');
      await Promise.all([w.paths[path](), w.reconcile(), w.paths[path](), w.reconcile()]);
      expect(await w.released()).toBe(700);
      expect(await w.balance()).toEqual({ a: 4_550, w: 450 });
    }
  });

  it('a path whose release fails (withheld short) alerts and writes nothing', async () => {
    const w = await setup();
    await w.hold(700);
    await pool.query(`UPDATE accounts SET withheld_balance = 100 WHERE id = $1`, [w.accountId]);
    await w.paths['failed-delivery item fault']();
    await w.paths['drop']();
    expect(await w.released()).toBe(0);
    expect((reportMoneyAnomaly as jest.Mock).mock.calls.map((c) => c[1])).toEqual([
      'agent_hold_release_failed',
      'agent_hold_release_failed',
    ]);
    // Completion throws (assertLedgerMove), so the settlement is retried rather than marked done.
    await expect(w.paths['completion']()).rejects.toThrow(/agent hold release failed/);
  });
});
