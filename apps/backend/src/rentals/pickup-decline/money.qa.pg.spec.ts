/**
 * QA #840 round 2, H5, on real Postgres: two workers cannot both claim one
 * pending decline refund.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=money.qa.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 * H3, H4, H6, and M5 are proved in rental-pickup-decline.service.spec.ts,
 * which runs without Postgres.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client, Pool } from 'pg';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const suite = TEMPLATE ? describe : describe.skip;
const sql = readFileSync(
  join(__dirname, '../../../../hasura/migrations/Rendasua/20261119140000_rentals_decline_refund_claim/up.sql'),
  'utf8'
);

suite('decline refund claim (real Postgres, QA #840 H5)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_decline_claim_${process.pid}_${Date.now()}`;
  let admin: Client;
  let pool: Pool;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    pool = new Pool({ database: dbName, max: 4 });
    pool.on('error', () => undefined);
    await pool.query(sql);
    await pool.query(`
      CREATE TABLE refund_claim_probe (
        id uuid PRIMARY KEY,
        refund_status text NOT NULL,
        refund_attempts integer NOT NULL,
        refund_claim_at timestamptz,
        refund_claim_token uuid
      )
    `);
  });

  afterAll(async () => {
    await pool?.end();
    if (!admin) return;
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.end();
  });

  it('lets one worker claim a pending refund and makes the other wait', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    await pool.query(
      `INSERT INTO refund_claim_probe (id, refund_status, refund_attempts) VALUES ($1, 'refund_pending', 0)`,
      [id]
    );
    const claim = (token: string) =>
      pool.query(
        `UPDATE refund_claim_probe
         SET refund_attempts = refund_attempts + 1, refund_claim_at = now(), refund_claim_token = $2
         WHERE id = $1 AND refund_status = 'refund_pending' AND refund_attempts = 0
           AND (refund_claim_at IS NULL OR refund_claim_at < now() - interval '2 minutes')
         RETURNING refund_attempts`,
        [id, token]
      );
    const [first, second] = await Promise.all([claim('00000000-0000-4000-8000-000000000001'), claim('00000000-0000-4000-8000-000000000002')]);
    const won = [first.rowCount, second.rowCount].filter((count) => count === 1);
    expect(won).toHaveLength(1);
    const stored = await pool.query(`SELECT refund_attempts FROM refund_claim_probe WHERE id = $1`, [id]);
    expect(Number(stored.rows[0].refund_attempts)).toBe(1);
  });
});
