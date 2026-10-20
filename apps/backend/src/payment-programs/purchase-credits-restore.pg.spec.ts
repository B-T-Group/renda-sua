/**
 * #627 nit: restore_purchase_credit_redemption against real Postgres: the redemption
 * delete and the grant re-credit are one transaction, once per redemption.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \\
 *     npx nx test backend --testPathPattern=purchase-credits-restore.pg
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client, Pool } from 'pg';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const suite = TEMPLATE ? describe : describe.skip;
const up = (m: string) => readFileSync(join(MIGRATIONS, m, 'up.sql'), 'utf8');

suite('restore_purchase_credit_redemption (real Postgres)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_pc_restore_${process.pid}_${Date.now()}`;
  let admin: Client;
  let pool: Pool;
  let seq = 0;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    pool = new Pool({ database: dbName, max: 8 });
    pool.on('error', () => undefined);
    const has = (
      await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_credit_grants'`)
    ).rowCount;
    if (!has) await pool.query(`BEGIN;\n${up('1789840663276_payment_programs')}\nCOMMIT;`);
    const rev = (
      await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_credit_grants' AND column_name = 'revoked_at'`
      )
    ).rowCount;
    if (!rev) await pool.query(`BEGIN;\n${up('1789844770967_purchase_credit_grant_revoked_at')}\nCOMMIT;`);
    // The template has no orders: the order FK is not under test here.
    await pool.query(
      `ALTER TABLE purchase_credit_redemptions DROP CONSTRAINT IF EXISTS purchase_credit_redemptions_order_id_fkey`
    );
    await pool.query(`BEGIN;\n${up('20261020150000_restore_purchase_credit_redemption')}\nCOMMIT;`);
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  async function setup(amount = 1000, remaining = 400, redeemed = 600) {
    const n = ++seq;
    const user = (
      await pool.query(
        `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('client','C','T',$1) RETURNING id`,
        [`pc-${process.pid}-${n}-${Date.now()}@example.test`]
      )
    ).rows[0].id;
    const order = `5c1d2e3f-4a5b-4c6d-8e7f-${String(n).padStart(12, '0')}`;
    const grant = (
      await pool.query(
        `INSERT INTO purchase_credit_grants (user_id, currency, amount, remaining_amount, applicability)
         VALUES ($1,'XAF',$2,$3,'any_store') RETURNING id`,
        [user, amount, remaining]
      )
    ).rows[0].id;
    const red = (
      await pool.query(
        `INSERT INTO purchase_credit_redemptions (grant_id, order_id, amount) VALUES ($1,$2,$3) RETURNING id`,
        [grant, order, redeemed]
      )
    ).rows[0].id;
    const state = async () => ({
      remaining: Number((await pool.query(`SELECT remaining_amount FROM purchase_credit_grants WHERE id=$1`, [grant])).rows[0].remaining_amount),
      redemptions: (await pool.query(`SELECT 1 FROM purchase_credit_redemptions WHERE id=$1`, [red])).rowCount,
    });
    const restore = () => pool.query(`SELECT * FROM restore_purchase_credit_redemption($1)`, [red]);
    return { grant, red, state, restore };
  }

  it('deletes the redemption and re-credits the grant together', async () => {
    const w = await setup();
    const r = await w.restore();
    expect(r.rows.map((x) => x.id)).toEqual([w.red]);
    expect(await w.state()).toEqual({ remaining: 1000, redemptions: 0 });
  });

  it('8 concurrent restores credit once', async () => {
    const w = await setup();
    const rs = await Promise.all(Array.from({ length: 8 }, () => w.restore()));
    expect(rs.reduce((n, r) => n + (r.rowCount ?? 0), 0)).toBe(1);
    expect(await w.state()).toEqual({ remaining: 1000, redemptions: 0 });
  });

  it('a revoked grant: the redemption is deleted, nothing is credited', async () => {
    const w = await setup();
    await pool.query(`UPDATE purchase_credit_grants SET revoked_at = now() WHERE id=$1`, [w.grant]);
    await w.restore();
    expect(await w.state()).toEqual({ remaining: 400, redemptions: 0 });
  });

  it('a failing credit rolls the delete back too (the credit is never lost)', async () => {
    // remaining + amount would exceed the grant amount: the CHECK fails inside the function.
    const w = await setup(1000, 900, 600);
    await expect(w.restore()).rejects.toThrow(/check constraint/);
    expect(await w.state()).toEqual({ remaining: 900, redemptions: 1 });
  });
});
