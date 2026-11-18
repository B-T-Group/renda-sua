/**
 * Decline-refund claim SQL and the real refund service against Postgres.
 *
 *   DEDICATED_PG_TEMPLATE=template1 DECLINE_REFUND_PG=1 \
 *   PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres \
 *     npx nx test backend --testPathPattern=money.qa.pg
 *
 * The suite runs only with the template, a local host, a qa database name,
 * and DECLINE_REFUND_PG=1. CI sets those. A skipped suite fails the CI job
 * because CI must see the opt-in.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client, Pool } from 'pg';
import { RentalMomoRefundService } from './rental-momo-refund.service';
import { RentalPickupDeclineService } from './rental-pickup-decline.service';
import { stableRefundReference } from './pickup-decline.money';
import * as Q from './pickup-decline.queries';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const OPTED = process.env.DECLINE_REFUND_PG === '1';
const HOST = (process.env.PGHOST ?? '').trim();
const MIGRATION = join(__dirname, '../../../../hasura/migrations/Rendasua/20261119140000_rentals_decline_refund_claim/up.sql');

describe('decline refund postgres job', () => {
  it('is configured when CI runs this workflow', () => {
    if (process.env.CI !== 'true') return;
    expect(TEMPLATE).toBeTruthy();
    expect(OPTED).toBe(true);
    expect(HOST === '127.0.0.1' || HOST === 'localhost').toBe(true);
  });

  it('refuses to drop a database outside the local qa opt-in', () => {
    expect(() => assertCanDrop('production', '127.0.0.1', true)).toThrow(/refusing/);
    expect(() => assertCanDrop('rs_decline_qa_1', 'db.internal', true)).toThrow(/refusing/);
    expect(() => assertCanDrop('rs_decline_qa_1', '127.0.0.1', false)).toThrow(/refusing/);
    expect(() => assertCanDrop('rs_decline_qa_1', '127.0.0.1', true)).not.toThrow();
  });
});

const live = Boolean(TEMPLATE) && OPTED && isLocal(HOST);
const suite = live ? describe : describe.skip;

suite('decline refund claim on real Postgres', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_decline_qa_${process.pid}`;
  let admin: Client;
  let pool: Pool;
  let created = false;

  beforeAll(async () => {
    assertCanDrop(dbName, HOST, OPTED);
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${quoteIdent(dbName)} TEMPLATE ${quoteIdent(TEMPLATE!)}`);
    created = true;
    pool = new Pool({ database: dbName, max: 8 });
    pool.on('error', () => undefined);
    await pool.query(SCHEMA);
    await pool.query(readFileSync(MIGRATION, 'utf8'));
  });

  afterAll(async () => {
    await pool?.end();
    if (!created) return;
    assertCanDrop(dbName, HOST, OPTED);
    await admin.query(`DROP DATABASE ${quoteIdent(dbName)}`);
    await admin.end();
  });

  it('claims a pending refund for one worker', async () => {
    const id = await seed(pool);
    const [first, second] = await Promise.all([claim(pool, id, 0), claim(pool, id, 0)]);
    expect([first, second].filter((rows) => rows === 1)).toHaveLength(1);
  });

  it('keeps a FreemoPay timeout pending, then credits once when status is failed', async () => {
    const id = await seed(pool, { refund_status: 'none', status: 'cancelled' });
    const provider = fakeProvider();
    const wallet = { credits: 0 };
    const service = build(pool, provider, wallet);
    provider.check = missingThen(timeoutError);
    const result = await service.refundLateCollect(id, collect(id));
    expect(result).toBeUndefined();
    expect(provider.withdraws.map((row) => row.externalId)).toEqual([stableRefundReference(id)]);
    expect(await statusOf(pool, id)).toBe('refund_pending');
    expect(wallet.credits).toBe(0);
    provider.check = async () => ({ status: 'FAILED' });
    await ageClaim(pool, id);
    expect(await service.reconcilePending()).toBe(1);
    expect(await statusOf(pool, id)).toBe('failed');
    expect(wallet.credits).toBe(1);
    expect(provider.withdraws).toHaveLength(1);
    expect(await service.reconcilePending()).toBe(0);
    expect(wallet.credits).toBe(1);
  });

  it('does not send a second FreemoPay withdrawal when the status call fails', async () => {
    const id = await seed(pool, { refund_provider_ref: stableRefundReference(idRef()), refund_provider: 'freemopay' });
    const provider = fakeProvider();
    provider.check = async () => {
      throw new Error('socket hang up');
    };
    const wallet = { credits: 0 };
    const service = build(pool, provider, wallet);
    expect(await service.reconcilePending()).toBe(0);
    expect(provider.withdraws).toHaveLength(0);
    expect(wallet.credits).toBe(0);
    expect(await statusOf(pool, id)).toBe('refund_pending');
  });

  it('does not let the cron pay while the first attempt is in flight', async () => {
    const id = await seed(pool, { refund_status: 'none', status: 'cancelled' });
    const provider = fakeProvider();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    provider.check = missingThen(timeoutError);
    provider.withdraw = async (body: { externalId: string }) => {
      provider.withdraws.push(body);
      await gate;
      return { success: false, ambiguous: true, status: 'UNKNOWN' };
    };
    const wallet = { credits: 0 };
    const service = build(pool, provider, wallet);
    const running = service.refundLateCollect(id, collect(id));
    await waitFor(() => provider.withdraws.length === 1);
    expect(await service.reconcilePending()).toBe(0);
    release();
    await running;
    expect(provider.withdraws).toHaveLength(1);
    expect(provider.withdraws[0].externalId).toBe(stableRefundReference(id));
    expect(wallet.credits).toBe(0);
    expect(await statusOf(pool, id)).toBe('refund_pending');
  });

  it('aborts the write and the credit when the claim token was taken', async () => {
    const id = await seed(pool);
    const provider = fakeProvider();
    let release: (value: { status: string }) => void = () => undefined;
    provider.check = () => new Promise((resolve) => {
      release = resolve;
    });
    const wallet = { credits: 0 };
    const service = build(pool, provider, wallet);
    const running = service.reconcilePending();
    await waitFor(async () => Boolean((await readClaim(pool, id)).refund_claim_token));
    await pool.query(`UPDATE rental_bookings SET refund_claim_token = gen_random_uuid() WHERE id = $1`, [id]);
    release({ status: 'FAILED' });
    expect(await running).toBe(0);
    expect(wallet.credits).toBe(0);
    expect(await statusOf(pool, id)).toBe('refund_pending');
    expect(provider.withdraws).toHaveLength(0);
  });

  it('does not resend FreemoPay when a stored reference is missing', async () => {
    const id = await seed(pool, { refund_provider: 'freemopay', refund_provider_ref: stableRefundReference('stored') });
    const provider = fakeProvider();
    const wallet = { credits: 0 };
    const service = build(pool, provider, wallet);
    expect(await service.reconcilePending()).toBe(0);
    expect(provider.withdraws).toHaveLength(0);
    expect(wallet.credits).toBe(0);
    expect(Q.APPLY_OWNED_REFUND).toContain('refund_claim_token');
    expect(Q.KEEP_REFUND_CLAIM).toContain('refund_claim_token');
    expect(Q.STAMP_REFUND).toContain('refund_status');
  });
});

function assertCanDrop(dbName: string, host: string, opted: boolean): void {
  const local = host === '127.0.0.1' || host === 'localhost' || host.startsWith('/');
  const safe = /qa|test/i.test(dbName);
  if (!local || !opted || !safe) throw new Error(`refusing to drop ${dbName}`);
}

function isLocal(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host.startsWith('/');
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function timeoutError(): never {
  const error: any = new Error('timeout');
  error.status = 504;
  throw error;
}

function missingThen(later: () => never) {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls === 1) {
      const error: any = new Error('not found');
      error.status = 404;
      throw error;
    }
    return later();
  };
}

function idRef(): string {
  return '11111111-1111-4111-8111-111111111111';
}

function collect(bookingId: string) {
  return {
    amount: 1000,
    currency: 'XAF',
    provider: 'freemopay',
    phone: '237600000000',
    transactionId: `tx-${bookingId}`,
    channel: null,
  };
}

function fakeProvider() {
  const provider = {
    withdraws: [] as Array<{ externalId: string }>,
    check: async (): Promise<{ status: string }> => {
      const error: any = new Error('not found');
      error.status = 404;
      throw error;
    },
    withdraw: async (body: { externalId: string }) => {
      provider.withdraws.push(body);
      return { success: true, reference: 'fp-ref', ambiguous: false };
    },
  };
  return provider;
}

async function waitFor(ready: () => boolean | Promise<boolean>): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('timed out waiting for the refund claim');
}

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE rental_bookings (
  id uuid PRIMARY KEY,
  booking_number text,
  status text,
  payment_status text,
  contract_expires_at timestamptz,
  actual_start_at timestamptz,
  inspection_policy_version int,
  pickup_current_version_id uuid,
  pickup_accepted_version_id uuid,
  condition_declined_at timestamptz,
  refund_status text NOT NULL DEFAULT 'none',
  refund_attempts int NOT NULL DEFAULT 0,
  refund_next_at timestamptz,
  refund_requested_at timestamptz,
  refund_status_at timestamptz,
  refunded_at timestamptz,
  refund_amount numeric,
  refund_currency text,
  refund_provider text,
  refund_provider_ref text,
  authorized_amount numeric,
  total_amount numeric,
  currency text,
  client_id uuid,
  business_id uuid
);
CREATE TABLE rental_condition_declines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rental_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid,
  notes text
);
`;

async function seed(pool: Pool, over: Record<string, unknown> = {}): Promise<string> {
  const id = crypto.randomUUID();
  const row = {
    id,
    booking_number: `RB-${id.slice(0, 8)}`,
    status: 'cancelled',
    refund_status: 'refund_pending',
    refund_attempts: 0,
    refund_amount: 1000,
    refund_currency: 'XAF',
    refund_provider: 'freemopay',
    refund_provider_ref: stableRefundReference(id),
    currency: 'XAF',
    condition_declined_at: new Date().toISOString(),
    refund_next_at: new Date(Date.now() - 60_000).toISOString(),
    ...over,
  };
  const keys = Object.keys(row);
  await pool.query(
    `INSERT INTO rental_bookings (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
    keys.map((key) => row[key as keyof typeof row])
  );
  return id;
}

async function claim(pool: Pool, id: string, attempts: number): Promise<number> {
  const token = crypto.randomUUID();
  const result = await pool.query(
    `UPDATE rental_bookings
     SET refund_attempts = $2, refund_claim_at = now(), refund_claim_token = $3
     WHERE id = $1 AND refund_status = 'refund_pending' AND refund_attempts = $4
       AND (refund_claim_at IS NULL OR refund_claim_at < now() - interval '2 minutes')`,
    [id, attempts + 1, token, attempts]
  );
  return result.rowCount ?? 0;
}

async function statusOf(pool: Pool, id: string): Promise<string> {
  const result = await pool.query(`SELECT refund_status FROM rental_bookings WHERE id = $1`, [id]);
  return result.rows[0].refund_status;
}

async function readClaim(pool: Pool, id: string): Promise<{ refund_claim_token: string | null }> {
  const result = await pool.query(`SELECT refund_claim_token FROM rental_bookings WHERE id = $1`, [id]);
  return result.rows[0];
}

async function ageClaim(pool: Pool, id: string): Promise<void> {
  await pool.query(
    `UPDATE rental_bookings
     SET refund_claim_at = now() - interval '3 minutes', refund_next_at = now() - interval '1 minute'
     WHERE id = $1`,
    [id]
  );
}

function build(pool: Pool, provider: ReturnType<typeof fakeProvider>, wallet: { credits: number }) {
  const freemopay = {
    withdraw: (body: { externalId: string }) => provider.withdraw(body),
    checkTransactionStatus: () => provider.check(),
  };
  const momo = new RentalMomoRefundService(unused('mtn') as never, freemopay as never, unused('feda') as never, unused('mypvit') as never);
  const hasura = sqlHasura(pool);
  return new RentalPickupDeclineService(
    hasura as never,
    { getUser: async () => ({ id: 'user-1' }) } as never,
    {} as never,
    momo,
    {} as never,
    { notifySupportConditionRefund: async () => undefined, sendConditionDeclinedNotice: async () => undefined } as never,
    { clearPinForOrder: async () => undefined } as never,
    {
      consumeDeclineHold: async () => undefined,
      restoreDeclinePayout: async () => {
        wallet.credits += 1;
      },
      releaseFreeCancelFunds: async () => undefined,
    } as never,
    {} as never
  );
}

function unused(name: string) {
  return new Proxy({}, { get: () => () => Promise.reject(new Error(`${name} unused`)) });
}

function sqlHasura(pool: Pool) {
  return {
    executeQuery: async (query: string, vars: Record<string, string> = {}) => {
      if (query.includes('DeclineBooking')) return { rental_bookings_by_pk: await shaped(pool, vars.id) };
      if (query.includes('PendingDeclineRefunds')) return { rental_bookings: await pending(pool, vars.now, vars.stale) };
      if (query.includes('DeclineCollects')) return { mobile_payment_transactions: [] };
      if (query.includes('DeclineHold')) return { rental_holds: [] };
      if (query.includes('FindConditionDecline') || query.includes('FindDeclineForBooking')) return { rental_condition_declines: [] };
      return {};
    },
    executeMutation: async (query: string, vars: Record<string, unknown>) => applyMutation(pool, query, vars),
  };
}

async function shaped(pool: Pool, id: string) {
  const result = await pool.query(`SELECT * FROM rental_bookings WHERE id = $1`, [id]);
  return shape(result.rows[0]);
}

async function pending(pool: Pool, now: string, stale: string) {
  const result = await pool.query(
    `SELECT * FROM rental_bookings
     WHERE refund_status = 'refund_pending' AND condition_declined_at IS NOT NULL AND refund_attempts < 5
       AND (refund_next_at IS NULL OR refund_next_at <= $1)
       AND (refund_claim_at IS NULL OR refund_claim_at < $2)`,
    [now, stale]
  );
  return result.rows.map(shape);
}

function shape(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  return {
    ...row,
    client: { id: row.client_id, user_id: 'user-1', user: { first_name: 'A', last_name: 'B' } },
    business: { id: row.business_id, user_id: 'biz-user' },
    rental_location_listing: { rental_item: { name: 'JBL PartyBox 310' } },
  };
}

async function applyMutation(pool: Pool, query: string, vars: Record<string, unknown>) {
  if (query.includes('StampDeclineRefund')) return { update_rental_bookings: { affected_rows: await stamp(pool, vars) } };
  if (query.includes('ClaimDeclineRefund')) return { update_rental_bookings: { affected_rows: await claimWork(pool, vars) } };
  if (query.includes('RememberDeclineRefundRef')) return { update_rental_bookings: { affected_rows: await remember(pool, vars) } };
  if (query.includes('KeepDeclineRefundClaim')) return { update_rental_bookings: { affected_rows: await keep(pool, vars) } };
  if (query.includes('ApplyOwnedDeclineRefund')) return { update_rental_bookings: { affected_rows: await owned(pool, vars) } };
  return { update_rental_bookings: { affected_rows: 0 } };
}

async function stamp(pool: Pool, vars: Record<string, unknown>): Promise<number> {
  return writeSet(pool, vars.set as Record<string, unknown>, `id = $1 AND status = 'cancelled' AND refund_status = 'none'`, [vars.id]);
}

async function claimWork(pool: Pool, vars: Record<string, unknown>): Promise<number> {
  return writeSet(
    pool,
    vars.set as Record<string, unknown>,
    `id = $1 AND refund_status = 'refund_pending' AND refund_attempts = $2 AND (refund_claim_at IS NULL OR refund_claim_at < $3)`,
    [vars.id, vars.attempts, vars.stale]
  );
}

async function remember(pool: Pool, vars: Record<string, unknown>): Promise<number> {
  const result = await pool.query(
    `UPDATE rental_bookings SET refund_provider = $2, refund_provider_ref = $3
     WHERE id = $1 AND refund_status = 'refund_pending' AND refund_provider_ref IS NULL`,
    [vars.id, vars.provider, vars.ref]
  );
  return result.rowCount ?? 0;
}

async function keep(pool: Pool, vars: Record<string, unknown>): Promise<number> {
  const result = await pool.query(
    `UPDATE rental_bookings SET refund_claim_at = $3
     WHERE id = $1 AND refund_status = 'refund_pending' AND refund_claim_token = $2`,
    [vars.id, vars.token, vars.at]
  );
  return result.rowCount ?? 0;
}

async function owned(pool: Pool, vars: Record<string, unknown>): Promise<number> {
  return writeSet(
    pool,
    vars.set as Record<string, unknown>,
    `id = $1 AND refund_status = 'refund_pending' AND refund_claim_token = $2`,
    [vars.id, vars.token]
  );
}

async function writeSet(pool: Pool, set: Record<string, unknown>, where: string, params: unknown[]): Promise<number> {
  const keys = Object.keys(set).filter((key) => /^[a-z_]+$/.test(key));
  const assigns = keys.map((key, index) => `${key} = $${params.length + index + 1}`);
  const result = await pool.query(
    `UPDATE rental_bookings SET ${assigns.join(', ')} WHERE ${where}`,
    [...params, ...keys.map((key) => set[key])]
  );
  return result.rowCount ?? 0;
}
