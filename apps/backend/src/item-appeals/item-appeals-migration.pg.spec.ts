/**
 * Rejected-item appeals migration against real Postgres: constraints, the
 * withdraw/category/condition triggers, the overturn write order, and down/up.
 *
 *   DEDICATED_PG_TEMPLATE=rs_base PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=item-appeals-migration.pg
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client, Pool } from 'pg';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const M = '20261101120000_item_rejection_appeals';
const suite = TEMPLATE ? describe : describe.skip;
const sql = (f: 'up' | 'down') => readFileSync(join(MIGRATIONS, M, `${f}.sql`), 'utf8');

suite('item rejection appeals migration (real Postgres)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_item_appeals_${process.pid}_${Date.now()}`;
  let admin: Client;
  let pool: Pool;
  let businessId: string;
  let adminUserId: string;
  let subCat: number;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE}`);
    pool = new Pool({ database: dbName, max: 4 });
    pool.on('error', () => undefined);
    await pool.query(`BEGIN;\n${sql('up')}\nCOMMIT;`);
    const tag = `${process.pid}-${Date.now()}`;
    const u = await pool.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('business','B','T',$1) RETURNING id`,
      [`appeal-biz-${tag}@example.test`]
    );
    const a = await pool.query(
      `INSERT INTO users (user_type_id, first_name, last_name, email) VALUES ('admin','A','T',$1) RETURNING id`,
      [`appeal-admin-${tag}@example.test`]
    );
    adminUserId = a.rows[0].id;
    businessId = (await pool.query(`INSERT INTO businesses (user_id, name) VALUES ($1,'Appeal Biz') RETURNING id`, [u.rows[0].id]))
      .rows[0].id;
    subCat = (await pool.query(`SELECT id FROM item_sub_categories ORDER BY id LIMIT 1`)).rows[0].id;
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  /** A rejected item with its rejection record + pointer, as the API writes it. */
  async function rejectedItem(category = 'photo_quality') {
    const item = (
      await pool.query(
        `INSERT INTO items (name, item_sub_category_id, business_id, moderation_status, rejection_category)
         VALUES ('Lamp', $1, $2, 'rejected', $3) RETURNING id`,
        [subCat, businessId, category]
      )
    ).rows[0].id as string;
    const rej = (
      await pool.query(
        `INSERT INTO item_rejections (item_id, category, reason, reviewer_id, source) VALUES ($1,$2,'blurry',$3,'admin') RETURNING id`,
        [item, category, adminUserId]
      )
    ).rows[0].id as string;
    await pool.query(`UPDATE items SET current_rejection_id = $2 WHERE id = $1`, [item, rej]);
    return { item, rej };
  }
  async function appeal(item: string, rej: string) {
    return (
      await pool.query(
        `INSERT INTO item_appeals (rejection_id, item_id, business_id, reason, sla_due_at)
         VALUES ($1,$2,$3,'This photo is my real product, see the label',now() + interval '48 hours') RETURNING id`,
        [rej, item, businessId]
      )
    ).rows[0].id as string;
  }
  const appealRow = async (id: string) =>
    (await pool.query(`SELECT status::text, withdrawn_reason FROM item_appeals WHERE id=$1`, [id])).rows[0];

  it('a rejected item must carry a category, and the category clears when it leaves rejected', async () => {
    await expect(
      pool.query(`INSERT INTO items (name, item_sub_category_id, business_id, moderation_status) VALUES ('X',$1,$2,'rejected')`, [
        subCat,
        businessId,
      ])
    ).rejects.toThrow(/items_rejected_requires_category_chk/);
    const { item } = await rejectedItem();
    await pool.query(`UPDATE items SET moderation_status='pending' WHERE id=$1`, [item]);
    const r = await pool.query(`SELECT rejection_category FROM items WHERE id=$1`, [item]);
    expect(r.rows[0].rejection_category).toBeNull();
  });

  it('only one pending appeal per rejection; a withdrawn one does not block', async () => {
    const { item, rej } = await rejectedItem();
    const first = await appeal(item, rej);
    await expect(appeal(item, rej)).rejects.toThrow(/item_appeals_one_pending_per_rejection/);
    await pool.query(`UPDATE item_appeals SET status='withdrawn', withdrawn_reason='business' WHERE id=$1`, [first]);
    await expect(appeal(item, rej)).resolves.toEqual(expect.any(String));
  });

  it('reason length, evidence count, and upheld-needs-note are enforced', async () => {
    const { item, rej } = await rejectedItem();
    await expect(
      pool.query(
        `INSERT INTO item_appeals (rejection_id,item_id,business_id,reason,sla_due_at) VALUES ($1,$2,$3,'too short',now())`,
        [rej, item, businessId]
      )
    ).rejects.toThrow(/check/i);
    await expect(
      pool.query(
        `INSERT INTO item_appeals (rejection_id,item_id,business_id,reason,evidence_urls,sla_due_at)
         VALUES ($1,$2,$3,repeat('a',25),ARRAY['https://a','https://b','https://c','https://d'],now())`,
        [rej, item, businessId]
      )
    ).rejects.toThrow(/check/i);
    const id = await appeal(item, rej);
    await expect(
      pool.query(`UPDATE item_appeals SET status='upheld', admin_id=$2, decided_at=now(), admin_note='  ' WHERE id=$1`, [id, adminUserId])
    ).rejects.toThrow(/item_appeals_upheld_needs_note_chk/);
    await expect(pool.query(`UPDATE item_appeals SET status='upheld', admin_note='no' WHERE id=$1`, [id])).rejects.toThrow(
      /item_appeals_decided_fields_chk/
    );
  });

  it('resubmit (rejected -> pending) withdraws the pending appeal as resubmitted', async () => {
    const { item, rej } = await rejectedItem();
    const id = await appeal(item, rej);
    await pool.query(`UPDATE items SET moderation_status='pending' WHERE id=$1`, [item]);
    expect(await appealRow(id)).toEqual({ status: 'withdrawn', withdrawn_reason: 'resubmitted' });
  });

  it('soft delete withdraws the pending appeal as item_deleted', async () => {
    const { item, rej } = await rejectedItem();
    const id = await appeal(item, rej);
    await pool.query(`UPDATE items SET status='deleted' WHERE id=$1`, [item]);
    expect(await appealRow(id)).toEqual({ status: 'withdrawn', withdrawn_reason: 'item_deleted' });
  });

  it('a direct moderator approve supersedes the pending appeal', async () => {
    const { item, rej } = await rejectedItem();
    const id = await appeal(item, rej);
    await pool.query(`UPDATE items SET moderation_status='approved' WHERE id=$1`, [item]);
    expect(await appealRow(id)).toEqual({ status: 'withdrawn', withdrawn_reason: 'superseded' });
  });

  it('overturn order (appeal first, then item) keeps the appeal overturned', async () => {
    for (const target of ['approved', 'pending']) {
      const { item, rej } = await rejectedItem();
      const id = await appeal(item, rej);
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query(
          `UPDATE item_appeals SET status='overturned', admin_id=$2, decided_at=now(), outcome_moderation_status=$3 WHERE id=$1 AND status='pending'`,
          [id, adminUserId, target]
        );
        await c.query(`UPDATE items SET moderation_status=$2::item_moderation_status WHERE id=$1 AND moderation_status='rejected'`, [
          item,
          target,
        ]);
        await c.query('COMMIT');
      } finally {
        c.release();
      }
      expect(await appealRow(id)).toEqual({ status: 'overturned', withdrawn_reason: null });
    }
  });

  it('condition and is_used stay in sync both ways; wear note length is bounded', async () => {
    const i = (
      await pool.query(`INSERT INTO items (name,item_sub_category_id,business_id,is_used) VALUES ('U',$1,$2,true) RETURNING id, condition::text`, [
        subCat,
        businessId,
      ])
    ).rows[0];
    expect(i.condition).toBe('used');
    await pool.query(`UPDATE items SET condition='new' WHERE id=$1`, [i.id]);
    expect((await pool.query(`SELECT is_used FROM items WHERE id=$1`, [i.id])).rows[0].is_used).toBe(false);
    await pool.query(`UPDATE items SET condition='refurbished', wear_note='Small scratch on the lid' WHERE id=$1`, [i.id]);
    expect((await pool.query(`SELECT is_used FROM items WHERE id=$1`, [i.id])).rows[0].is_used).toBe(true);
    await expect(pool.query(`UPDATE items SET wear_note='short' WHERE id=$1`, [i.id])).rejects.toThrow(/check/i);
  });

  it('down then up again is clean', async () => {
    await pool.query(`BEGIN;\n${sql('down')}\nCOMMIT;`);
    const gone = await pool.query(`SELECT to_regclass('public.item_appeals') t, to_regclass('public.item_rejections') r`);
    expect(gone.rows[0]).toEqual({ t: null, r: null });
    await pool.query(`BEGIN;\n${sql('up')}\nCOMMIT;`);
    const back = await pool.query(`SELECT to_regclass('public.item_appeals')::text t`);
    expect(back.rows[0].t).toBe('item_appeals');
  });
});
