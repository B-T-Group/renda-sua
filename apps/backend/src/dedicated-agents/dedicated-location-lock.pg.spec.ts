/**
 * Residual slot race (QA #603/#613) against a real Postgres. The slot toggle and the
 * super-user assign are Hasura mutations; each runs its root fields in order in one
 * transaction. The statements below are the SQL those documents produce
 * (`savePickupSlotsMutation`, `INSERT_DEDICATED_ASSIGNMENTS_MUTATION`), the first being
 * the no-op `update_business_locations_by_pk` row lock.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=dedicated-location-lock.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { INSERT_DEDICATED_ASSIGNMENTS_MUTATION, savePickupSlotsMutation } from './dedicated-assignments.queries';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const FIRST_594 = '20261018180000';
const suite = TEMPLATE ? describe : describe.skip;

async function connect(database: string): Promise<Client> {
  const client = new Client({ database });
  await client.connect();
  return client;
}

/** The lock field must be the first root field of both documents (it runs first). */
describe('location lock field order', () => {
  it.each([
    ['super-user assign', INSERT_DEDICATED_ASSIGNMENTS_MUTATION, 'insert_dedicated_agent_assignments'],
    ['slot toggle with pauses', savePickupSlotsMutation(true), 'insert_business_location_pickup_slots'],
    ['slot toggle without pauses', savePickupSlotsMutation(false), 'insert_business_location_pickup_slots'],
  ])('%s locks business_locations before its writes', (_k, doc, firstWrite) => {
    const lock = doc.indexOf('update_business_locations_by_pk(pk_columns: { id: $locationId }, _set: { updated_at: "now()" })');
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(doc.indexOf(firstWrite));
    expect(doc).toContain('$locationId: uuid!');
  });
});

suite('business_locations FOR NO KEY UPDATE lock (real Postgres)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_p594_loclock_${process.pid}_${Date.now()}`;
  let admin: Client;
  let db: Client;
  let seq = 0;

  beforeAll(async () => {
    admin = await connect('postgres');
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    db = await connect(dbName);
    const dirs = readdirSync(MIGRATIONS)
      .filter((d) => /^\d{14}_/.test(d) && d.slice(0, 14) >= FIRST_594)
      .sort();
    for (const dir of dirs) {
      await db.query(`BEGIN;\n${readFileSync(join(MIGRATIONS, dir, 'up.sql'), 'utf8')}\nCOMMIT;`);
    }
  });

  afterAll(async () => {
    await db?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  async function user(first: string): Promise<string> {
    const r = await db.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('agent', $1, 'T', $2) RETURNING id`,
      [first, `${first.toLowerCase()}-${process.pid}-${++seq}@example.test`]
    );
    return r.rows[0].id;
  }
  async function agent(): Promise<string> {
    const r = await db.query(
      `INSERT INTO agents (user_id, vehicle_type_id, is_verified) VALUES ($1, 'wheeler_2', true) RETURNING id`,
      [await user('Agent')]
    );
    return r.rows[0].id;
  }
  async function location(): Promise<{ id: string; owner: string }> {
    const owner = await user('Owner');
    const biz = await db.query(`INSERT INTO businesses (user_id, name) VALUES ($1, 'Chez Mama') RETURNING id`, [owner]);
    const addr = await db.query(
      `INSERT INTO addresses (address_line_1, city, state, postal_code, country) VALUES ('Rue 1', 'Douala', 'Littoral', '0000', 'CM') RETURNING id`
    );
    const loc = await db.query(
      `INSERT INTO business_locations (business_id, address_id, name) VALUES ($1, $2, 'Chez Mama Akwa') RETURNING id`,
      [biz.rows[0].id, addr.rows[0].id]
    );
    return { id: loc.rows[0].id, owner };
  }

  const LOCK = `UPDATE business_locations SET updated_at = now() WHERE id = $1`;
  const assignTx = async (c: Client, locId: string, agentId: string, withLock: boolean) => {
    await c.query('BEGIN');
    if (withLock) await c.query(LOCK, [locId]);
    await c.query(
      `INSERT INTO dedicated_agent_assignments (business_location_id, agent_id, slot_key, source) VALUES ($1, $2, 'morning', 'superuser_assign')`,
      [locId, agentId]
    );
  };
  const toggleOffTx = async (c: Client, locId: string, withLock: boolean) => {
    await c.query('BEGIN');
    if (withLock) await c.query(LOCK, [locId]);
    await c.query(
      `INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'morning', false)
       ON CONFLICT ON CONSTRAINT business_location_pickup_slots_location_slot_key DO UPDATE SET is_enabled = EXCLUDED.is_enabled`,
      [locId]
    );
    const paused = await c.query(
      `UPDATE dedicated_agent_assignments SET status = 'paused', paused_at = now()
        WHERE business_location_id = $1 AND slot_key = 'morning' AND status = 'active' RETURNING id`,
      [locId]
    );
    await c.query('COMMIT');
    return paused.rowCount;
  };
  const waitingOnLock = async (pid: number) => {
    for (let i = 0; i < 50; i++) {
      const r = await db.query(`SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1`, [pid]);
      if (r.rows[0]?.wait_event_type === 'Lock') return true;
      await new Promise((res) => setTimeout(res, 20));
    }
    return false;
  };
  const status = async (locId: string) =>
    (await db.query(`SELECT status FROM dedicated_agent_assignments WHERE business_location_id = $1`, [locId])).rows.map((r) => r.status);

  it('control: without the lock, a toggle racing an uncommitted assign leaves an active row on an off slot', async () => {
    const loc = await location();
    const a = await agent();
    const c1 = await connect(dbName);
    const c2 = await connect(dbName);
    try {
      await assignTx(c1, loc.id, a, false);
      expect(await toggleOffTx(c2, loc.id, false)).toBe(0); // the pause cannot see the uncommitted row
      await c1.query('COMMIT');
      expect(await status(loc.id)).toEqual(['active']);
    } finally {
      await c1.end();
      await c2.end();
    }
  });

  it('with the lock, the toggle waits for the assign and then pauses its row', async () => {
    const loc = await location();
    const a = await agent();
    const c1 = await connect(dbName);
    const c2 = await connect(dbName);
    try {
      await assignTx(c1, loc.id, a, true);
      const pid2 = (await c2.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const toggle = toggleOffTx(c2, loc.id, true);
      expect(await waitingOnLock(pid2)).toBe(true);
      await c1.query('COMMIT');
      expect(await toggle).toBe(1);
      expect(await status(loc.id)).toEqual(['paused']);
    } finally {
      await c1.end();
      await c2.end();
    }
  });

  it('the updated_at lock (FOR NO KEY UPDATE) does not block FK inserts (KEY SHARE); `id = id` or FOR UPDATE would', async () => {
    const loc = await location();
    const c1 = await connect(dbName);
    const c2 = await connect(dbName);
    try {
      await c2.query(`SET lock_timeout = '300ms'`);
      await c1.query('BEGIN');
      await c1.query(LOCK, [loc.id]);
      await expect(
        c2.query(`INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'evening', true)`, [loc.id])
      ).resolves.toBeDefined();
      await c1.query('ROLLBACK');

      // `SET id = id` (a key column in the target list, with the updated_at trigger)
      // takes FOR UPDATE and blocks the FK insert: why the lock sets updated_at only.
      await c1.query('BEGIN');
      await c1.query(`UPDATE business_locations SET id = id WHERE id = $1`, [loc.id]);
      await expect(
        c2.query(`INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'morning', true)`, [loc.id])
      ).rejects.toThrow(/lock timeout/);
      await c1.query('ROLLBACK');

      await c1.query('BEGIN');
      await c1.query(`SELECT 1 FROM business_locations WHERE id = $1 FOR UPDATE`, [loc.id]);
      await expect(
        c2.query(`INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'afternoon', true)`, [loc.id])
      ).rejects.toThrow(/lock timeout/);
      await c1.query('ROLLBACK');
    } finally {
      await c1.end();
      await c2.end();
    }
  });
});
