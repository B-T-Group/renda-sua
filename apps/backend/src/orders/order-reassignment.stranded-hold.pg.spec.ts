/**
 * #622 against a real Postgres ledger: claim -> release -> re-claim -> stranded.
 *
 * AccountsService and OrderReassignmentService are the real classes. Their Hasura
 * calls for the ledger (accounts, account_transactions) run as the equivalent SQL
 * on a real database, so the numeric sums, the guarded balance update and the
 * UNIQUE account_transactions.idempotency_key are Postgres's own. Only the order
 * and order_events reads of the reconciler are in memory.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=stranded-hold.pg
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
import { OrderReassignmentService } from './order-reassignment.service';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const suite = TEMPLATE ? describe : describe.skip;
const op = (q: string) => /(?:query|mutation) (\w+)/.exec(q)?.[1] ?? '?';

/** The ledger slice of HasuraSystemService, as SQL. */
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

suite('#622 net agent hold release (real Postgres ledger)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_p622_hold_${process.pid}_${Date.now()}`;
  let admin: Client;
  let pool: Pool;
  let seq = 0;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    pool = new Pool({ database: dbName, max: 8 });
    // The template predates the cash-advance column the ledger writes.
    const ca = (
      await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cash_advance_balance'`
      )
    ).rowCount;
    if (!ca)
      await pool.query(
        `BEGIN;\n${readFileSync(
          join(MIGRATIONS, '1789840663276_payment_programs', 'up.sql'),
          'utf8'
        )}\nCOMMIT;`
      );
    // The function under test, from its migration as-is.
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
  });
  afterEach(() => jest.restoreAllMocks());

  const ORDER = '7d1f4a52-3c1e-4b7e-9a51-0f6f2a1b9c11';
  async function setup(opening = 5_000) {
    const u = await pool.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('agent', 'A', 'T', $1) RETURNING id`,
      [`agent-${process.pid}-${++seq}@example.test`]
    );
    const userId = u.rows[0].id as string;
    const acct = await pool.query(
      `INSERT INTO accounts (user_id, currency, available_balance) VALUES ($1, 'XAF', $2) RETURNING id`,
      [userId, opening]
    );
    const accountId = acct.rows[0].id as string;
    const orderId = ORDER.slice(0, -2) + String(seq).padStart(2, '0');
    const mem = {
      events: [] as any[],
      current: 'agent-2' as string | null,
      orderNumber: `ORD-${seq}`,
    };
    const hasura = pgHasura(pool, {
      events: mem.events,
      assigned: () => mem.current,
      orderNumber: mem.orderNumber,
    });
    const accounts = new AccountsService(hasura as any);
    let evSeq = 0;
    const push = async (p: any) =>
      void mem.events.push({
        id: `ev-${seq}-${++evSeq}`,
        order_id: p.orderId,
        event_type: p.eventType,
        payload: { ...p.payload },
      });
    const orderEvents = {
      recordEvent: jest.fn(push),
      recordEventStrict: jest.fn(push),
    };
    const svc = new OrderReassignmentService(
      hasura as any,
      orderEvents as any,
      {} as any,
      {} as any,
      accounts
    );
    // A second pod: its own service instance (no shared in-process guard), same database.
    const svc2 = new OrderReassignmentService(
      hasura as any,
      orderEvents as any,
      {} as any,
      {} as any,
      new AccountsService(hasura as any)
    );
    const order = {
      id: orderId,
      order_number: mem.orderNumber,
      assigned_agent_id: 'agent-1',
      currency: 'XAF',
      assigned_agent: { id: 'agent-1', user_id: userId },
    } as any;
    const claim = async (amount = 700) => {
      const r = await accounts.registerTransaction({
        accountId,
        amount,
        transactionType: 'hold',
        memo: 'claim',
        referenceId: orderId,
      });
      expect(r.success).toBe(true);
    };
    const credit = () =>
      (svc as any).creditHoldRelease(order, {
        agent_hold_amount: 700,
      }) as Promise<boolean>;
    const balance = async () => {
      const r = await pool.query(
        `SELECT available_balance::float AS a, withheld_balance::float AS w FROM accounts WHERE id = $1`,
        [accountId]
      );
      return r.rows[0] as { a: number; w: number };
    };
    const releases = async () =>
      (
        await pool.query(
          `SELECT amount::float AS amount, idempotency_key FROM account_transactions WHERE account_id = $1 AND transaction_type = 'release' ORDER BY created_at`,
          [accountId]
        )
      ).rows;
    const strand = () =>
      (svc as any).recordStrandedHold(
        order,
        { id: 'hold-1', agent_hold_amount: 700 },
        'pickup_reassignment'
      );
    return {
      accounts,
      svc,
      svc2,
      userId,
      mem,
      accountId,
      orderId,
      claim,
      credit,
      balance,
      releases,
      strand,
    };
  }

  it('control: claim -> release -> re-claim, a reference-checked release credits nothing (the bug)', async () => {
    const w = await setup();
    await w.claim();
    await w.accounts.registerReleaseIfNotExists({
      accountId: w.accountId,
      amount: 700,
      memo: 'r1',
      referenceId: w.orderId,
    });
    await w.claim();
    const second = await w.accounts.registerReleaseIfNotExists({
      accountId: w.accountId,
      amount: 700,
      memo: 'r2',
      referenceId: w.orderId,
    });
    expect(second).toMatchObject({ success: true, alreadyExists: true });
    expect(await w.balance()).toEqual({ a: 4_300, w: 700 }); // 700 stays withheld
  });

  it('claim -> release -> re-claim -> stranded: the reconciler releases the net once; a second run is a no-op', async () => {
    const w = await setup();
    await w.claim();
    expect(await w.credit()).toBe(true); // first cycle released by creditHoldRelease (net 700)
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
    await w.claim(); // re-claim
    await w.strand(); // the second release failed and the order was lost
    expect(await w.balance()).toEqual({ a: 4_300, w: 700 });

    await expect(w.svc.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
    expect(
      (await w.releases()).map((r: any) => [r.amount, r.idempotency_key])
    ).toEqual([
      [700, `agent-hold-release:${w.orderId}:${w.accountId}:h1:r0`],
      [700, `agent-hold-release:${w.orderId}:${w.accountId}:h2:r1`],
    ]);
    const resolved = w.mem.events.filter(
      (e) => e.event_type === 'agent_hold_stranded_released'
    );
    expect(resolved).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ released: 700, net: 0 }),
      }),
    ]);

    // Double run: resolved -> filtered out; and even un-marking it, the re-run finds net 0.
    await expect(w.svc.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 0,
      skipped: 0,
      failed: 0,
    });
    delete w.mem.events[0].payload.resolvedAt;
    await expect(w.svc.reconcileStrandedAgentHolds()).resolves.toEqual({
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(
      w.mem.events
        .filter((e) => e.event_type === 'agent_hold_stranded_released')
        .at(-1).payload
    ).toMatchObject({ released: 0, net: 0 });
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
    expect(await w.releases()).toHaveLength(2);
  });

  it('creditHoldRelease retried (same ledger state) never double-credits', async () => {
    const w = await setup();
    await w.claim();
    const [a, b, c] = await Promise.all([w.credit(), w.credit(), w.credit()]);
    expect([a, b, c]).toEqual([true, true, true]);
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
    expect(await w.releases()).toHaveLength(1);
  });

  it('reconciler racing a live creditHoldRelease on the same stranded hold: released exactly once', async () => {
    const w = await setup();
    await w.claim();
    expect(await w.credit()).toBe(true);
    await w.claim();
    await w.strand();
    const results = await Promise.all([
      w.svc.reconcileStrandedAgentHolds(),
      w.credit(),
      w.svc.reconcileStrandedAgentHolds(),
    ]);
    expect(results[1]).toBe(true);
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
    const rel = await w.releases();
    expect(rel.reduce((t: number, r: any) => t + r.amount, 0)).toBe(1_400); // 700 per cycle, never more
    expect(rel).toHaveLength(2);
  });

  it('PE blocker: re-claimed and released mid-reconcile -> the live release and the reconciler credit the strand once; other orders untouched', async () => {
    for (let round = 0; round < 6; round++) {
      const w = await setup();
      const otherOrder = '9e2b1c33-4d5e-4f60-8a71-0b1c2d3e4f5' + round;
      await w.accounts.registerTransaction({ accountId: w.accountId, amount: 450, transactionType: 'hold', memo: 'other order', referenceId: otherOrder });
      await w.claim(); // cycle 1
      await w.strand(); // its release failed and the order was lost: 700 stranded
      await w.claim(); // the agent re-claims (cycle 2): 1400 held on this order
      expect(await w.balance()).toEqual({ a: 3_150, w: 1_850 });
      // ...and is released while the reconciler (which saw the order not theirs) runs.
      const jobs = [w.credit(), w.svc.reconcileStrandedAgentHolds(), w.svc2.reconcileStrandedAgentHolds()];
      if (round % 2) jobs.reverse();
      const out = await Promise.all(jobs);
      expect(out.filter((r) => r === false)).toEqual([]);
      const rel = await w.releases();
      expect(rel.reduce((t: number, r: any) => t + r.amount, 0)).toBe(1_400); // never 2100
      expect(await w.balance()).toEqual({ a: 4_550, w: 450 }); // the other order's 450 stays held
      const net = await pool.query(
        `SELECT coalesce(sum(CASE WHEN transaction_type = 'hold' THEN amount ELSE -amount END), 0)::float AS n
           FROM account_transactions WHERE account_id = $1 AND reference_id = $2`,
        [w.accountId, w.orderId]
      );
      expect(net.rows[0].n).toBe(0);
    }
  });

  it('the function writes the balance and the ledger row together (no balance move without its row)', async () => {
    const w = await setup();
    await w.claim();
    const r = await pool.query(`SELECT * FROM release_agent_order_hold($1, $2, NULL, 'm')`, [w.accountId, w.orderId]);
    expect(r.rows).toHaveLength(1);
    expect(Number(r.rows[0].amount)).toBe(700);
    expect(r.rows[0].idempotency_key).toBe(`agent-hold-release:${w.orderId}:${w.accountId}:h1:r0`);
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
    // A withheld balance short of the net raises and writes nothing (balance nor row).
    await w.claim();
    await pool.query(`UPDATE accounts SET withheld_balance = 100 WHERE id = $1`, [w.accountId]);
    await expect(pool.query(`SELECT * FROM release_agent_order_hold($1, $2, NULL, 'm')`, [w.accountId, w.orderId])).rejects.toThrow(/agent_hold_release_withheld_short/);
    expect(await w.releases()).toHaveLength(1);
    expect((await w.balance()).w).toBe(100);
    // The cap: never more than p_cap even when more is held.
    await pool.query(`UPDATE accounts SET withheld_balance = 700 WHERE id = $1`, [w.accountId]);
    const c = await pool.query(`SELECT * FROM release_agent_order_hold($1, $2, 200, 'm')`, [w.accountId, w.orderId]);
    expect(Number(c.rows[0].amount)).toBe(200);
    expect((await w.balance()).w).toBe(500);
    expect(c.rows[0].idempotency_key).toBe(`agent-hold-release:${w.orderId}:${w.accountId}:h2:r1`);
    // An existing key is a no-op: another writer that read the same state (h2:r2) already
    // took the key (simulated with a non-hold/release row, so the counts stay h2:r2).
    await pool.query(
      `INSERT INTO account_transactions (account_id, amount, transaction_type, memo, idempotency_key) VALUES ($1, 1, 'deposit', 'k', $2)`,
      [w.accountId, `agent-hold-release:${w.orderId}:${w.accountId}:h2:r2`]
    );
    const k = await pool.query(`SELECT * FROM release_agent_order_hold($1, $2, NULL, 'm')`, [w.accountId, w.orderId]);
    expect(k.rows).toHaveLength(0);
    expect((await w.balance()).w).toBe(500);
  });

  it('#622 I1: withheld < net (real function) -> nothing written and the withheld-short money alert fires', async () => {
    const w = await setup();
    await w.claim();
    await pool.query(`UPDATE accounts SET withheld_balance = 100 WHERE id = $1`, [w.accountId]);
    const { reportMoneyAnomaly } = jest.requireMock('../common/utils/money-alert.util');
    (reportMoneyAnomaly as jest.Mock).mockClear();
    const r = await (w.svc as any).releaseNetAgentHold(w.accountId, w.orderId, 'm');
    expect(r).toMatchObject({ success: false, released: 0, net: 700 });
    expect(await w.releases()).toHaveLength(0);
    expect((await w.balance()).w).toBe(100);
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(),
      'agent_hold_withheld_short',
      expect.stringContaining('agent_hold_release_withheld_short'),
      expect.objectContaining({ accountId: w.accountId, orderId: w.orderId, net: 700 })
    );
  });

  it("QA #622 F2: two pods reconcile the same strand concurrently -> one credit; another order's hold is untouched", async () => {
    const w = await setup();
    const otherOrder = '9e2b1c33-4d5e-4f60-8a71-0b1c2d3e4f50';
    await w.accounts.registerTransaction({
      accountId: w.accountId,
      amount: 450,
      transactionType: 'hold',
      memo: 'other order',
      referenceId: otherOrder,
    });
    await w.claim();
    await w.strand();
    expect(await w.balance()).toEqual({ a: 3_850, w: 1_150 });
    const runs = await Promise.all([
      w.svc.reconcileStrandedAgentHolds(),
      w.svc2.reconcileStrandedAgentHolds(),
      w.svc.reconcileStrandedAgentHolds(),
      w.svc2.reconcileStrandedAgentHolds(),
    ]);
    expect(runs.reduce((t, r) => t + r.failed, 0)).toBe(0);
    // Exactly 700 back. 1150 withheld would let the guard pass a 2nd 700: only the key stops it.
    // The other order's 450 stays withheld.
    expect(await w.balance()).toEqual({ a: 4_550, w: 450 });
    const rel = await w.releases();
    expect(rel).toEqual([
      {
        amount: 700,
        idempotency_key: `agent-hold-release:${w.orderId}:${w.accountId}:h1:r0`,
      },
    ]);
    expect(w.mem.events[0].payload).toHaveProperty('resolvedAt');
  });

  it('never more than the net: a partial release earlier leaves only the remainder to release', async () => {
    const w = await setup();
    await w.claim(700);
    await w.accounts.registerTransaction({
      accountId: w.accountId,
      amount: 200,
      transactionType: 'release',
      memo: 'partial',
      referenceId: w.orderId,
    });
    expect(await w.credit()).toBe(true);
    expect(await w.balance()).toEqual({ a: 5_000, w: 0 });
    expect((await w.releases()).map((r: any) => r.amount)).toEqual([200, 500]);
  });
});
