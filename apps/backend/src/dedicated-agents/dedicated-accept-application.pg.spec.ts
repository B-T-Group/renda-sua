/**
 * #594 PR 7 AC-E8 against a real Postgres: `dedicated_accept_application`
 * (20261018220000) under concurrent accepts. Needs a local cluster and a
 * template database holding the schema before #594 (all migrations older than
 * 20261018180000); every #594 migration is applied from the repo onto a scratch
 * copy, so the SQL under test is the committed file.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=dedicated-accept-application.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const FIRST_594 = '20261018180000';
const suite = TEMPLATE ? describe : describe.skip;

async function connect(database: string): Promise<Client> {
  const client = new Client({ database });
  await client.connect();
  return client;
}

suite('dedicated_accept_application (real Postgres, AC-E8)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_p594_e8_${process.pid}_${Date.now()}`;
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    admin = await connect('postgres');
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    db = await connect(dbName);
    const dirs = readdirSync(MIGRATIONS)
      .filter((d) => /^\d{14}_/.test(d) && d.slice(0, 14) >= FIRST_594)
      .sort();
    expect(dirs).toContain('20261018220000_dedicated_postings');
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
  async function user(first: string): Promise<string> {
    const r = await db.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('agent', $1, 'T', $2) RETURNING id`,
      [first, `${first.toLowerCase()}-${process.pid}-${++seq}@example.test`]
    );
    return r.rows[0].id;
  }
  async function agent(first: string, opts: { verified?: boolean; contract?: string | null } = {}): Promise<string> {
    const userId = await user(first);
    const r = await db.query(
      `INSERT INTO agents (user_id, vehicle_type_id, is_verified) VALUES ($1, 'wheeler_2', $2) RETURNING id`,
      [userId, opts.verified ?? true]
    );
    const contract = opts.contract === undefined ? 'signed' : opts.contract;
    if (contract) {
      await db.query(
        `INSERT INTO agent_contracts (agent_id, template_key, boldsign_template_id, boldsign_document_id, contract_number, status)
         VALUES ($1, 'agent_v1', 'tpl', $2, $2, $3::contract_status_enum)`,
        [r.rows[0].id, `doc-${process.pid}-${++seq}`, contract]
      );
    }
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
  async function posting(
    loc: { id: string; owner: string },
    headcount: number,
    slots: string[],
    extra: { status?: string; expiresAt?: string } = {}
  ): Promise<string> {
    const r = await db.query(
      `INSERT INTO dedicated_agent_postings (business_location_id, headcount, created_by_user_id, expires_at)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, now() + interval '14 days')) RETURNING id`,
      [loc.id, headcount, loc.owner, extra.expiresAt ?? null]
    );
    const id = r.rows[0].id;
    for (const s of slots) {
      await db.query(
        `INSERT INTO dedicated_agent_posting_slots (posting_id, business_location_id, slot_key) VALUES ($1, $2, $3)`,
        [id, loc.id, s]
      );
    }
    if (extra.status) await db.query(`UPDATE dedicated_agent_postings SET status = $2 WHERE id = $1`, [id, extra.status]);
    return id;
  }
  async function apply(postingId: string, agentId: string): Promise<string> {
    const r = await db.query(
      `INSERT INTO dedicated_agent_applications (posting_id, agent_id) VALUES ($1, $2) RETURNING id`,
      [postingId, agentId]
    );
    return r.rows[0].id;
  }
  const accept = (c: Client, appId: string, actor: string) =>
    c.query(`SELECT id, status FROM dedicated_accept_application($1, $2)`, [appId, actor]);
  async function snapshot(postingId: string) {
    const p = await db.query(`SELECT status, accepted_count, filled_at FROM dedicated_agent_postings WHERE id = $1`, [postingId]);
    const apps = await db.query(
      `SELECT id, status, decided_at FROM dedicated_agent_applications WHERE posting_id = $1 ORDER BY created_at, id`,
      [postingId]
    );
    const asg = await db.query(
      `SELECT agent_id, slot_key, status, source, application_id FROM dedicated_agent_assignments WHERE posting_id = $1 ORDER BY slot_key`,
      [postingId]
    );
    const slots = await db.query(`SELECT slot_key, is_open FROM dedicated_agent_posting_slots WHERE posting_id = $1 ORDER BY slot_key`, [postingId]);
    return {
      posting: p.rows[0],
      apps: Object.fromEntries(apps.rows.map((a) => [a.id, a.status])),
      assignments: asg.rows,
      slots: slots.rows,
    };
  }

  it('two concurrent accepts for the last spot: the second waits on the posting lock and finds it filled', async () => {
    const loc = await location();
    const p = await posting(loc, 1, ['morning', 'evening']);
    const [a1, a2, a3] = [await agent('Awa'), await agent('Bo'), await agent('Cy')];
    const [x1, x2, x3] = [await apply(p, a1), await apply(p, a2), await apply(p, a3)];
    const c1 = await connect(dbName);
    const c2 = await connect(dbName);
    try {
      await c1.query('BEGIN');
      const first = await accept(c1, x1, loc.owner);
      // c2 starts while c1 still holds the posting lock.
      const second = accept(c2, x2, loc.owner);
      const blocked = await Promise.race([
        second.then(() => 'returned'),
        new Promise((r) => setTimeout(() => r('blocked'), 400)),
      ]);
      expect(blocked).toBe('blocked');
      await c1.query('COMMIT');
      const late = await second;

      expect(first.rows.find((r) => r.id === x1)?.status).toBe('accepted');
      expect(first.rows.filter((r) => r.status === 'auto_declined').map((r) => r.id).sort()).toEqual([x2, x3].sort());
      expect(late.rows).toEqual([{ id: x2, status: 'auto_declined' }]);
    } finally {
      await c1.end();
      await c2.end();
    }
    const s = await snapshot(p);
    expect(s.posting).toMatchObject({ status: 'filled', accepted_count: 1 });
    expect(s.posting.filled_at).not.toBeNull();
    expect(s.apps).toEqual({ [x1]: 'accepted', [x2]: 'auto_declined', [x3]: 'auto_declined' });
    expect(s.assignments).toEqual([
      { agent_id: a1, slot_key: 'evening', status: 'active', source: 'posting', application_id: x1 },
      { agent_id: a1, slot_key: 'morning', status: 'active', source: 'posting', application_id: x1 },
    ]);
    expect(s.slots.every((x) => x.is_open === false)).toBe(true);
  });

  it('racing accepts (no ordering forced) never exceed the headcount', async () => {
    for (let round = 0; round < 6; round++) {
      const loc = await location();
      const p = await posting(loc, 2, ['afternoon']);
      const agents = [await agent('R1'), await agent('R2'), await agent('R3'), await agent('R4')];
      const apps = [] as string[];
      for (const a of agents) apps.push(await apply(p, a));
      const clients = await Promise.all(apps.map(() => connect(dbName)));
      try {
        await Promise.all(apps.map((x, i) => accept(clients[i], x, loc.owner)));
      } finally {
        await Promise.all(clients.map((c) => c.end()));
      }
      const s = await snapshot(p);
      expect(s.posting).toMatchObject({ status: 'filled', accepted_count: 2 });
      expect(Object.values(s.apps).sort()).toEqual(['accepted', 'accepted', 'auto_declined', 'auto_declined']);
      expect(s.assignments).toHaveLength(2);
    }
  });

  it('accept #2 of 3 keeps the posting open and the other applicants pending', async () => {
    const loc = await location();
    const p = await posting(loc, 3, ['morning']);
    const ids = [] as string[];
    for (const n of ['H1', 'H2', 'H3', 'H4']) ids.push(await apply(p, await agent(n)));
    await accept(db, ids[0], loc.owner);
    const r = await accept(db, ids[1], loc.owner);
    expect(r.rows).toEqual([{ id: ids[1], status: 'accepted' }]);
    const s = await snapshot(p);
    expect(s.posting).toMatchObject({ status: 'open', accepted_count: 2, filled_at: null });
    expect(s.apps).toEqual({ [ids[0]]: 'accepted', [ids[1]]: 'accepted', [ids[2]]: 'applied', [ids[3]]: 'applied' });
    expect(s.slots).toEqual([{ slot_key: 'morning', is_open: true }]);
  });

  it.each([
    ['closed', { status: 'closed' }],
    ['expired by date (sweeper not run yet)', { expiresAt: '2020-01-01T00:00:00Z' }],
  ])('refuses on a %s posting and changes nothing', async (_label, extra) => {
    const loc = await location();
    const p = await posting(loc, 1, ['morning'], extra);
    const x = await apply(p, await agent('Late'));
    const r = await accept(db, x, loc.owner);
    expect(r.rows).toEqual([{ id: x, status: 'applied' }]);
    const s = await snapshot(p);
    expect(s.posting.accepted_count).toBe(0);
    expect(s.assignments).toEqual([]);
  });

  it('refuses when the count is already at headcount even if the status still says open (defence in depth)', async () => {
    const loc = await location();
    const p = await posting(loc, 1, ['morning']);
    await db.query(`UPDATE dedicated_agent_postings SET accepted_count = 1 WHERE id = $1`, [p]);
    const x = await apply(p, await agent('Over'));
    expect((await accept(db, x, loc.owner)).rows).toEqual([{ id: x, status: 'applied' }]);
    const s = await snapshot(p);
    expect(s.posting).toMatchObject({ status: 'open', accepted_count: 1 });
    expect(s.assignments).toEqual([]);
  });

  it('refuses an application that is no longer pending (withdrawn)', async () => {
    const loc = await location();
    const p = await posting(loc, 1, ['morning']);
    const x = await apply(p, await agent('W'));
    await db.query(`UPDATE dedicated_agent_applications SET status = 'withdrawn', withdrawn_at = now() WHERE id = $1`, [x]);
    expect((await accept(db, x, loc.owner)).rows).toEqual([{ id: x, status: 'withdrawn' }]);
    expect((await snapshot(p)).assignments).toEqual([]);
  });

  it('refuses when the agent already holds one of the posting slots at this store', async () => {
    const loc = await location();
    const a = await agent('Holder');
    await db.query(
      `INSERT INTO dedicated_agent_assignments (business_location_id, agent_id, slot_key, source) VALUES ($1, $2, 'evening', 'superuser_assign')`,
      [loc.id, a]
    );
    const p = await posting(loc, 1, ['morning', 'evening']);
    const x = await apply(p, a);
    expect((await accept(db, x, loc.owner)).rows).toEqual([{ id: x, status: 'applied' }]);
    const s = await snapshot(p);
    expect(s.posting).toMatchObject({ status: 'open', accepted_count: 0 });
    expect(s.assignments).toEqual([]);
  });

  it('a cap refusal (3 live assignments elsewhere) rolls the whole accept back', async () => {
    const a = await agent('Busy');
    for (const slot of ['morning', 'afternoon', 'evening']) {
      const other = await location();
      await db.query(
        `INSERT INTO dedicated_agent_assignments (business_location_id, agent_id, slot_key, source) VALUES ($1, $2, $3, 'superuser_assign')`,
        [other.id, a, slot]
      );
    }
    const loc = await location();
    const p = await posting(loc, 1, ['morning']);
    const x = await apply(p, a);
    const y = await apply(p, await agent('Other'));
    await expect(accept(db, x, loc.owner)).rejects.toThrow(/dedicated_agent_assignment_cap_exceeded/);
    const s = await snapshot(p);
    expect(s.posting).toMatchObject({ status: 'open', accepted_count: 0 });
    expect(s.apps).toEqual({ [x]: 'applied', [y]: 'applied' });
    expect(s.assignments).toEqual([]);
  });

  describe('QA #613 N2/N3: re-checks under the lock', () => {
    async function expectNothingWritten(p: string, x: string) {
      const s = await snapshot(p);
      expect(s.posting).toMatchObject({ status: 'open', accepted_count: 0 });
      expect(s.apps[x]).toBe('applied');
      expect(s.assignments).toEqual([]);
    }

    it('refuses when a posting slot was switched off at the store; an unrelated off slot does not matter', async () => {
      const loc = await location();
      const p = await posting(loc, 1, ['morning', 'evening']);
      const x = await apply(p, await agent('Ana'));
      await db.query(
        `INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'afternoon', false)`,
        [loc.id]
      );
      await db.query(
        `INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'morning', true)`,
        [loc.id]
      );
      const other = await location();
      await db.query(
        `INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'evening', false)`,
        [other.id]
      );
      await db.query(
        `INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'evening', false)`,
        [loc.id]
      );
      await expect(accept(db, x, loc.owner)).rejects.toThrow(/dedicated_accept_slot_disabled/);
      await expectNothingWritten(p, x);
      await db.query(`UPDATE business_location_pickup_slots SET is_enabled = true WHERE business_location_id = $1 AND slot_key = 'evening'`, [loc.id]);
      expect((await accept(db, x, loc.owner)).rows.find((r) => r.id === x)?.status).toBe('accepted');
    });

    it('a slot toggle racing the accept waits on the slot row lock', async () => {
      const loc = await location();
      await db.query(
        `INSERT INTO business_location_pickup_slots (business_location_id, slot_key, is_enabled) VALUES ($1, 'morning', true)`,
        [loc.id]
      );
      const p = await posting(loc, 1, ['morning']);
      const x = await apply(p, await agent('Race'));
      const c1 = await connect(dbName);
      const c2 = await connect(dbName);
      try {
        await c1.query('BEGIN');
        expect((await accept(c1, x, loc.owner)).rows.find((r) => r.id === x)?.status).toBe('accepted');
        await c2.query(`SET lock_timeout = '300ms'`);
        await expect(
          c2.query(`UPDATE business_location_pickup_slots SET is_enabled = false WHERE business_location_id = $1`, [loc.id])
        ).rejects.toThrow(/lock timeout/);
        await c1.query('COMMIT');
      } finally {
        await c1.end();
        await c2.end();
      }
    });

    it.each([
      ['not_verified', { verified: false }],
      ['contract_unsigned', { contract: null }],
      ['contract_unsigned', { contract: 'sent' }],
    ] as const)('refuses an applicant who is %s (%o)', async (reason, opts) => {
      const loc = await location();
      const p = await posting(loc, 1, ['morning']);
      const x = await apply(p, await agent('Nope', opts));
      await expect(accept(db, x, loc.owner)).rejects.toThrow(new RegExp(`dedicated_accept_agent_ineligible: ${reason}`));
      await expectNothingWritten(p, x);
    });

    it('refuses an applicant suspended after applying', async () => {
      const loc = await location();
      const p = await posting(loc, 1, ['morning']);
      const a = await agent('Sus');
      const x = await apply(p, a);
      await db.query(`UPDATE agents SET status = 'suspended' WHERE id = $1`, [a]);
      await expect(accept(db, x, loc.owner)).rejects.toThrow(/dedicated_accept_agent_ineligible: suspended/);
      await expectNothingWritten(p, x);
    });

    it('does not require a contract when the global flag is off (country rows are ignored)', async () => {
      const loc = await location();
      const p = await posting(loc, 1, ['morning']);
      const x = await apply(p, await agent('Free', { contract: null }));
      const prev = await db.query(
        `SELECT boolean_value FROM application_configurations WHERE config_key = 'agent_contract_required' AND country_code IS NULL`
      );
      // A country row saying "required" must not override the global flag (the gate reads the global row).
      await db.query(
        `INSERT INTO application_configurations (config_key, config_name, data_type, boolean_value, country_code)
         VALUES ('agent_contract_required', 'Agent contract required (CM)', 'boolean', true, 'CM')`
      );
      try {
        await db.query(
          `UPDATE application_configurations SET boolean_value = false WHERE config_key = 'agent_contract_required' AND country_code IS NULL`
        );
        expect((await accept(db, x, loc.owner)).rows.find((r) => r.id === x)?.status).toBe('accepted');
      } finally {
        await db.query(
          `UPDATE application_configurations SET boolean_value = $1 WHERE config_key = 'agent_contract_required' AND country_code IS NULL`,
          [prev.rows[0]?.boolean_value ?? true]
        );
        await db.query(`DELETE FROM application_configurations WHERE config_key = 'agent_contract_required' AND country_code = 'CM'`);
      }
    });
  });

  it('an unknown application returns no rows', async () => {
    const loc = await location();
    expect((await accept(db, '00000000-0000-0000-0000-000000000000', loc.owner)).rows).toEqual([]);
  });
});
