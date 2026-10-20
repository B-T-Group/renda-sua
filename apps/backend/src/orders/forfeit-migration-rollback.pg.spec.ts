/**
 * QA #632: rolling back 20261020010000 must not re-open forfeited holds. After the down
 * migration, release_agent_order_hold still subtracts forfeits, so a forfeited hold is
 * never paid out again.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=forfeit-migration-rollback.pg
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client, Pool } from 'pg';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const suite = TEMPLATE ? describe : describe.skip;
const sql = (m: string, f: 'up' | 'down') => readFileSync(join(MIGRATIONS, m, `${f}.sql`), 'utf8');
const RELEASE = '20261019230000_release_agent_order_hold';
const FORFEIT = '20261020010000_forfeit_agent_order_hold';

suite('forfeit migration rollback keeps forfeits out of the release net (real Postgres)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_forfeit_down_${process.pid}_${Date.now()}`;
  let admin: Client;
  let pool: Pool;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    pool = new Pool({ database: dbName, max: 4 });
    pool.on('error', () => undefined);
    for (const m of [RELEASE, FORFEIT]) await pool.query(`BEGIN;\n${sql(m, 'up')}\nCOMMIT;`);
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  async function account(email: string, available: number, withheld = 0) {
    const u = await pool.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('agent','A','T',$1) RETURNING id`,
      [email]
    );
    return (
      await pool.query(
        `INSERT INTO accounts (user_id, currency, available_balance, withheld_balance) VALUES ($1,'XAF',$2,$3) RETURNING id`,
        [u.rows[0].id, available, withheld]
      )
    ).rows[0].id as string;
  }
  const bal = async (id: string) =>
    (await pool.query(`SELECT available_balance::float a, withheld_balance::float w FROM accounts WHERE id=$1`, [id]))
      .rows[0];

  it('a hold forfeited before the rollback is not released to the agent after it; a fresh hold still releases', async () => {
    const tag = `${process.pid}-${Date.now()}`;
    const agent = await account(`fd-agent-${tag}@example.test`, 4_300, 0);
    const biz = await account(`fd-biz-${tag}@example.test`, 0);
    const order = '7d1e2f30-4a5b-4c6d-8e7f-90a1b2c3d4e5';
    const other = '7d1e2f30-4a5b-4c6d-8e7f-90a1b2c3d4e6';
    // A 700 hold on the order, and a 900 hold on another order (withheld = 1600), so the old
    // net would find enough withheld to pay the forfeited 700 out again (QA's double pay).
    await pool.query(`UPDATE accounts SET withheld_balance = 1600 WHERE id=$1`, [agent]);
    await pool.query(
      `INSERT INTO account_transactions (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
       VALUES ($1,700,'hold','claim',$2,$4), ($1,900,'hold','claim',$3,$5)`,
      [agent, order, other, `h1-${order}`, `h1-${other}`]
    );
    await pool.query(`SELECT * FROM forfeit_agent_order_hold($1,$2,$3,NULL,'f','b')`, [agent, biz, order]);
    expect(await bal(agent)).toEqual({ a: 4_300, w: 900 });
    expect((await bal(biz)).a).toBe(700);

    await pool.query(`BEGIN;\n${sql(FORFEIT, 'down')}\nCOMMIT;`);
    const fn = await pool.query(`SELECT 1 FROM pg_proc WHERE proname = 'forfeit_agent_order_hold'`);
    expect(fn.rowCount).toBe(0);

    // The reconciler / any path now releases the forfeited order: nothing may move.
    const r = await pool.query(`SELECT * FROM release_agent_order_hold($1,$2,NULL,'late')`, [agent, order]);
    expect(r.rowCount).toBe(0);
    expect(await bal(agent)).toEqual({ a: 4_300, w: 900 });
    // The other order's hold still releases normally.
    const r2 = await pool.query(`SELECT * FROM release_agent_order_hold($1,$2,NULL,'done')`, [agent, other]);
    expect(r2.rows.map((x) => Number(x.amount))).toEqual([900]);
    expect(await bal(agent)).toEqual({ a: 5_200, w: 0 });
    // Total conserved: 4300 + 1600 = 5200 agent + 700 business.
    expect((await bal(agent)).a + (await bal(biz)).a).toBe(5_900);
  });
});
