/**
 * #594 QA #607 N1 against a real Postgres: `dedicated_claim_order`
 * (20261018200001). The cap count and the assign run under the agent row lock,
 * so concurrent dedicated claims for one agent can't pass the cap together.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=dedicated-claim-order.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { DEDICATED_ACTIVE_ORDER_STATUSES } from '../dedicated-agents/dedicated-coverage.service';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const FIRST_594 = '20261018180000';
const suite = TEMPLATE ? describe : describe.skip;

async function connect(database: string): Promise<Client> {
  const client = new Client({ database });
  await client.connect();
  return client;
}

suite('dedicated_claim_order (real Postgres, QA #607 N1/N4)', () => {
  jest.setTimeout(90_000);
  const dbName = `rs_p594_claim_${process.pid}_${Date.now()}`;
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    admin = await connect('postgres');
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    db = await connect(dbName);
    const dirs = readdirSync(MIGRATIONS)
      .filter((d) => /^\d{14}_/.test(d) && d.slice(0, 14) >= FIRST_594)
      .sort();
    expect(dirs).toContain('20261018200001_dedicated_claim_order');
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

  let seq = 0;
  async function user(first: string, type = 'agent'): Promise<string> {
    const r = await db.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ($1, $2, 'T', $3) RETURNING id`,
      [type, first, `${first.toLowerCase()}-${process.pid}-${++seq}@example.test`]
    );
    return r.rows[0].id;
  }
  async function agent(): Promise<{ id: string; userId: string }> {
    const userId = await user('Agent');
    const r = await db.query(
      `INSERT INTO agents (user_id, vehicle_type_id, is_verified) VALUES ($1, 'wheeler_2', true) RETURNING id`,
      [userId]
    );
    return { id: r.rows[0].id, userId };
  }
  let store: { business: string; location: string; client: string } | null = null;
  async function shop() {
    if (store) return store;
    const owner = await user('Owner', 'business');
    const biz = await db.query(`INSERT INTO businesses (user_id, name) VALUES ($1, 'Chez Mama') RETURNING id`, [owner]);
    const addr = await db.query(
      `INSERT INTO addresses (address_line_1, city, state, postal_code, country) VALUES ('Rue 1', 'Douala', 'Littoral', '0000', 'CM') RETURNING id`
    );
    const loc = await db.query(
      `INSERT INTO business_locations (business_id, address_id, name) VALUES ($1, $2, 'Akwa') RETURNING id`,
      [biz.rows[0].id, addr.rows[0].id]
    );
    const cu = await user('Client', 'client');
    const client = await db.query(`INSERT INTO clients (user_id) VALUES ($1) RETURNING id`, [cu]);
    store = { business: biz.rows[0].id, location: loc.rows[0].id, client: client.rows[0].id };
    return store;
  }
  async function order(status = 'ready_for_pickup', assignedAgentId: string | null = null): Promise<string> {
    const s = await shop();
    const r = await db.query(
      `INSERT INTO orders (order_number, client_id, business_id, business_location_id, current_status, assigned_agent_id)
       VALUES ($1, $2, $3, $4, $5::order_status, $6) RETURNING id`,
      [`ORD-${process.pid}-${++seq}`, s.client, s.business, s.location, status, assignedAgentId]
    );
    return r.rows[0].id;
  }
  async function busy(agentId: string, n: number) {
    for (let i = 0; i < n; i++) await order(i % 2 ? 'in_transit' : 'assigned_to_agent', agentId);
  }
  async function liveOffer(orderId: string, a: { id: string; userId: string }) {
    await db.query(
      `INSERT INTO order_offers (order_id, agent_id, user_id, offer_kind, expires_at) VALUES ($1, $2, $3, 'dedicated', now() + interval '5 minutes')`,
      [orderId, a.id, a.userId]
    );
  }
  const claim = (c: Client, orderId: string, agentId: string, max = 10, countOffers = true) =>
    c.query(
      `SELECT id, assigned_agent_id, current_status::text AS status, assignment_source FROM dedicated_claim_order($1, $2, 'assigned_to_agent', 'dedicated_auto', NULL, now() + interval '2 minutes', $3, $4)`,
      [orderId, agentId, max, countOffers]
    );
  const assignedTo = async (agentId: string) =>
    Number((await db.query(`SELECT count(*) FROM orders WHERE assigned_agent_id = $1 AND current_status::text = ANY($2)`, [agentId, [...DEDICATED_ACTIVE_ORDER_STATUSES]])).rows[0].count);

  it('counts the same statuses as the backend', async () => {
    const src = readFileSync(join(MIGRATIONS, '20261018200001_dedicated_claim_order', 'up.sql'), 'utf8');
    const list = /o\.current_status IN \(([^)]*)\)/.exec(src)?.[1] ?? '';
    expect(list.split(',').map((x) => x.trim().replace(/'/g, '')).sort()).toEqual([...DEDICATED_ACTIVE_ORDER_STATUSES].sort());
  });

  it('assigns and stamps under the cap; refuses at the cap without writing', async () => {
    const a = await agent();
    await busy(a.id, 9);
    const o1 = await order();
    const ok = await claim(db, o1, a.id);
    expect(ok.rows).toEqual([{ id: o1, assigned_agent_id: a.id, status: 'assigned_to_agent', assignment_source: 'dedicated_auto' }]);
    const o2 = await order();
    await expect(claim(db, o2, a.id)).rejects.toThrow(/dedicated_order_cap_exceeded/);
    expect((await db.query(`SELECT assigned_agent_id FROM orders WHERE id = $1`, [o2])).rows[0].assigned_agent_id).toBeNull();
  });

  it('an order no longer claimable returns no row', async () => {
    const [a, b] = [await agent(), await agent()];
    const o = await order();
    await claim(db, o, a.id);
    await expect(claim(db, o, b.id)).resolves.toMatchObject({ rows: [] });
    // Still ready_for_pickup but someone holds it: not claimable either.
    const held = await order('ready_for_pickup', a.id);
    await expect(claim(db, held, b.id)).resolves.toMatchObject({ rows: [] });
    expect((await db.query(`SELECT assigned_agent_id FROM orders WHERE id = $1`, [held])).rows[0].assigned_agent_id).toBe(a.id);
  });

  it('auto-assign counts other live dedicated offers; an accept (countOffers=false) does not, and never its own', async () => {
    const a = await agent();
    await busy(a.id, 8);
    await liveOffer(await order(), a);
    const target = await order();
    await liveOffer(target, a); // its own offer never counts
    // 8 active + 1 other offer = 9 < 10: auto-assign passes.
    await expect(claim(db, target, a.id, 10, true)).resolves.toMatchObject({ rows: [{ id: target }] });
    // 9 active + 1 other offer = 10: auto-assign refused, accept allowed.
    const next = await order();
    await expect(claim(db, next, a.id, 10, true)).rejects.toThrow(/dedicated_order_cap_exceeded/);
    await expect(claim(db, next, a.id, 10, false)).resolves.toMatchObject({ rows: [{ id: next }] });
  });

  it('race: the second claim waits on the agent lock and then counts the first one', async () => {
    const a = await agent();
    await busy(a.id, 9);
    const [o1, o2] = [await order(), await order()];
    const c1 = await connect(dbName);
    const c2 = await connect(dbName);
    try {
      await c1.query('BEGIN');
      const first = await claim(c1, o1, a.id);
      const second = claim(c2, o2, a.id).then(
        () => 'claimed',
        (e: Error) => e.message
      );
      const state = await Promise.race([second, new Promise((r) => setTimeout(() => r('blocked'), 400))]);
      expect(state).toBe('blocked');
      await c1.query('COMMIT');
      expect(first.rows).toHaveLength(1);
      expect(await second).toMatch(/dedicated_order_cap_exceeded/);
    } finally {
      await c1.end();
      await c2.end();
    }
    expect(await assignedTo(a.id)).toBe(10);
  });

  it('race, unforced: N concurrent claims never push the agent past the cap', async () => {
    for (let round = 0; round < 5; round++) {
      const a = await agent();
      await busy(a.id, 7);
      const orders = [] as string[];
      for (let i = 0; i < 6; i++) orders.push(await order());
      const clients = await Promise.all(orders.map(() => connect(dbName)));
      try {
        const results = await Promise.allSettled(orders.map((o, i) => claim(clients[i], o, a.id)));
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      } finally {
        await Promise.all(clients.map((c) => c.end()));
      }
      expect(await assignedTo(a.id)).toBe(10);
    }
  });
});
