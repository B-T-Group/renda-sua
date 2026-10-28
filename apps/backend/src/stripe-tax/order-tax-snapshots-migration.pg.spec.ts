/**
 * Runs the real up/down SQL of the tax migrations against an in-process Postgres (PGlite).
 *
 * PGlite is not a repo dependency yet, and it needs Node's --experimental-vm-modules under Jest,
 * so this suite is skipped unless BOTH hold: the module resolves (`npm i -D @electric-sql/pglite`,
 * or PGLITE_MODULE_PATH points at an install) and NODE_OPTIONS contains
 * --experimental-vm-modules. Run it with:
 *   NODE_OPTIONS=--experimental-vm-modules PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite \
 *     npx nx test backend --testPathPattern=order-tax-snapshots-migration.pg
 * The regex-only `order-tax-snapshots-migration.spec.ts` keeps running everywhere.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const sql = (dir: string, file: 'up' | 'down') =>
  readFileSync(join(MIGRATIONS, dir, `${file}.sql`), 'utf8');

const SNAPSHOTS = '20261028090000_order_tax_snapshots';
const REFUND_TAX = '20261028100000_stripe_refund_tax_amount';

function loadPglite(): any {
  const fromPath = process.env.PGLITE_MODULE_PATH;
  // Jest's resolver ignores package "exports" for a bare directory path: point at the CJS build.
  for (const id of [fromPath && join(fromPath, 'dist/index.cjs'), '@electric-sql/pglite']) {
    if (!id) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(id);
    } catch {
      /* try next */
    }
  }
  return null;
}

const pglite = loadPglite();
const vmModules = /--experimental-vm-modules/.test(process.env.NODE_OPTIONS ?? '');
const maybe = pglite && vmModules ? describe : describe.skip;

maybe('tax migrations on a real Postgres (PGlite)', () => {
  let db: any;

  beforeEach(async () => {
    db = new pglite.PGlite();
    // Minimal stand-ins for the pre-existing tables the migrations touch.
    await db.exec(`
      CREATE TABLE public.orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number text NOT NULL UNIQUE,
        total_amount numeric(12,2) NOT NULL,
        tax_amount numeric(12,2) NOT NULL DEFAULT 0,
        pre_tax_total numeric(12,2),
        tax_status text NOT NULL DEFAULT 'none',
        CONSTRAINT orders_tax_status_check CHECK (tax_status IN ('none','estimated','finalized'))
      );
      CREATE TABLE public.stripe_refunds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid REFERENCES public.orders(id),
        amount numeric(12,2) NOT NULL,
        status text NOT NULL DEFAULT 'pending'
      );
      INSERT INTO public.orders (id, order_number, total_amount, tax_status) VALUES
        ('00000000-0000-0000-0000-000000000001', 'ORD-1', 100.00, 'estimated'),
        ('00000000-0000-0000-0000-000000000002', 'ORD-2', 50.00, 'none');
      INSERT INTO public.stripe_refunds (order_id, amount, status)
        VALUES ('00000000-0000-0000-0000-000000000001', 40.00, 'succeeded');
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  const O1 = '00000000-0000-0000-0000-000000000001';
  const O2 = '00000000-0000-0000-0000-000000000002';
  const ordersDump = async () =>
    (await db.query(
      'SELECT id, order_number, total_amount, tax_amount, pre_tax_total FROM public.orders ORDER BY order_number'
    )).rows;
  const rejects = async (q: string, params: unknown[] = []) => {
    let err: unknown = null;
    try {
      await db.query(q, params);
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
  };
  const insertSnapshot = (orderId: string, status = 'estimated') =>
    db.query(
      `INSERT INTO public.order_tax_snapshots
         (order_id, status, currency, stripe_tax_calculation_id, estimated_tax_amount, pre_tax_amount, total_including_tax)
       VALUES ($1, $2, 'CAD', 'taxcalc_1', 13, 100, 113) RETURNING id`,
      [orderId, status]
    );

  describe(SNAPSHOTS, () => {
    it('applies cleanly, never touches orders money columns, and allows void', async () => {
      const before = await ordersDump();
      await db.exec(sql(SNAPSHOTS, 'up'));
      expect(await ordersDump()).toEqual(before);
      await db.query(`UPDATE public.orders SET tax_status = 'void' WHERE id = $1`, [O1]);
      await rejects(`UPDATE public.orders SET tax_status = 'bogus' WHERE id = $1`, [O1]);
    });

    it('enforces one snapshot per order, valid statuses and non-negative amounts', async () => {
      await db.exec(sql(SNAPSHOTS, 'up'));
      await insertSnapshot(O1);
      await rejects(
        `INSERT INTO public.order_tax_snapshots (order_id, currency, stripe_tax_calculation_id, estimated_tax_amount, pre_tax_amount, total_including_tax)
         VALUES ($1, 'CAD', 'taxcalc_2', 1, 1, 2)`,
        [O1]
      );
      await rejects(
        `INSERT INTO public.order_tax_snapshots (order_id, status, currency, stripe_tax_calculation_id, estimated_tax_amount, pre_tax_amount, total_including_tax)
         VALUES ($1, 'weird', 'CAD', 'taxcalc_2', 1, 1, 2)`,
        [O2]
      );
      await rejects(
        `INSERT INTO public.order_tax_snapshots (order_id, currency, stripe_tax_calculation_id, estimated_tax_amount, pre_tax_amount, total_including_tax)
         VALUES ($1, 'CAD', 'taxcalc_2', -1, 1, 2)`,
        [O2]
      );
    });

    it('backs the repository on_conflict constraint names, and the estimate upsert never overwrites a finalized snapshot', async () => {
      await db.exec(sql(SNAPSHOTS, 'up'));
      const names = (
        await db.query(
          `SELECT conname FROM pg_constraint WHERE conname IN ('order_tax_snapshots_order_id_key','order_tax_reversals_stripe_refund_id_key','order_tax_reversals_reference_key')`
        )
      ).rows.map((r: any) => r.conname);
      expect(names.sort()).toEqual([
        'order_tax_reversals_reference_key',
        'order_tax_reversals_stripe_refund_id_key',
        'order_tax_snapshots_order_id_key',
      ]);

      const upsert = (calc: string) =>
        db.query(
          `INSERT INTO public.order_tax_snapshots (order_id, status, currency, stripe_tax_calculation_id, estimated_tax_amount, pre_tax_amount, total_including_tax)
           VALUES ($1, 'estimated', 'CAD', $2, 13, 100, 113)
           ON CONFLICT ON CONSTRAINT order_tax_snapshots_order_id_key DO UPDATE
             SET status = EXCLUDED.status, voided_at = NULL, stripe_tax_calculation_id = EXCLUDED.stripe_tax_calculation_id
             WHERE order_tax_snapshots.status IN ('estimated', 'void')`,
          [O1, calc]
        );
      await upsert('taxcalc_A');
      await db.query(`UPDATE public.order_tax_snapshots SET status = 'void' WHERE order_id = $1`, [O1]);
      await upsert('taxcalc_B'); // void is re-openable
      let row = (await db.query(`SELECT status, stripe_tax_calculation_id FROM public.order_tax_snapshots`)).rows[0];
      expect(row).toEqual({ status: 'estimated', stripe_tax_calculation_id: 'taxcalc_B' });
      await db.query(
        `UPDATE public.order_tax_snapshots SET status = 'finalized', stripe_tax_transaction_id = 'tax_txn_1'`
      );
      await upsert('taxcalc_C'); // finalized is never overwritten
      row = (await db.query(`SELECT status, stripe_tax_calculation_id FROM public.order_tax_snapshots`)).rows[0];
      expect(row).toEqual({ status: 'finalized', stripe_tax_calculation_id: 'taxcalc_B' });
    });

    it('reversal ledger: unique per refund and per reference, positive amounts, cascades with the snapshot', async () => {
      await db.exec(sql(SNAPSHOTS, 'up'));
      const snapId = (await insertSnapshot(O1)).rows[0].id;
      const ins = (refund: string, ref: string, amount: number) =>
        db.query(
          `INSERT INTO public.order_tax_reversals (snapshot_id, order_id, stripe_refund_id, reference, mode, amount_minor, currency)
           VALUES ($1, $2, $3, $4, 'partial', $5, 'CAD')`,
          [snapId, O1, refund, ref, amount]
        );
      await ins('re_1', 'ORD-1_re_1', 4000);
      await rejects(
        `INSERT INTO public.order_tax_reversals (snapshot_id, order_id, stripe_refund_id, reference, mode, amount_minor, currency)
         VALUES ($1, $2, 're_1', 'other', 'partial', 1, 'CAD')`,
        [snapId, O1]
      );
      await rejects(
        `INSERT INTO public.order_tax_reversals (snapshot_id, order_id, stripe_refund_id, reference, mode, amount_minor, currency)
         VALUES ($1, $2, 're_2', 'ORD-1_re_1', 'partial', 1, 'CAD')`,
        [snapId, O1]
      );
      await rejects(
        `INSERT INTO public.order_tax_reversals (snapshot_id, order_id, stripe_refund_id, reference, mode, amount_minor, currency)
         VALUES ($1, $2, 're_3', 'ref3', 'partial', 0, 'CAD')`,
        [snapId, O1]
      );
      await db.query(`DELETE FROM public.order_tax_snapshots WHERE id = $1`, [snapId]);
      expect((await db.query(`SELECT count(*)::int AS n FROM public.order_tax_reversals`)).rows[0].n).toBe(0);
    });

    it('down: drops the tables, returns void orders to estimated, narrows the check; up again round-trips', async () => {
      await db.exec(sql(SNAPSHOTS, 'up'));
      await insertSnapshot(O1);
      await db.query(`UPDATE public.orders SET tax_status = 'void' WHERE id = $1`, [O1]);
      const before = await ordersDump();

      await db.exec(sql(SNAPSHOTS, 'down'));
      const tables = (
        await db.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'order_tax_%'`
        )
      ).rows;
      expect(tables).toEqual([]);
      expect((await db.query(`SELECT tax_status FROM public.orders WHERE id = $1`, [O1])).rows[0].tax_status).toBe('estimated');
      await rejects(`UPDATE public.orders SET tax_status = 'void' WHERE id = $1`, [O1]);
      expect(await ordersDump()).toEqual(before); // money columns untouched by down as well

      await db.exec(sql(SNAPSHOTS, 'down')); // down is re-runnable
      await db.exec(sql(SNAPSHOTS, 'up'));
      await db.exec(sql(SNAPSHOTS, 'up')); // and up is idempotent
      await db.query(`UPDATE public.orders SET tax_status = 'void' WHERE id = $1`, [O1]);
    });
  });

  describe(REFUND_TAX, () => {
    it('adds tax_refund_amount with default 0 for existing rows, rejects negatives, and is idempotent', async () => {
      await db.exec(sql(REFUND_TAX, 'up'));
      await db.exec(sql(REFUND_TAX, 'up'));
      const rows = (await db.query(`SELECT amount, tax_refund_amount FROM public.stripe_refunds`)).rows;
      expect(rows).toEqual([{ amount: '40.00', tax_refund_amount: '0.00' }]);
      await db.query(
        `INSERT INTO public.stripe_refunds (order_id, amount, tax_refund_amount, status) VALUES ($1, 100, 13, 'succeeded')`,
        [O1]
      );
      await rejects(
        `INSERT INTO public.stripe_refunds (order_id, amount, tax_refund_amount) VALUES ($1, 1, -0.01)`,
        [O1]
      );
    });

    it('down drops only the new column and keeps refund amounts; up/down/up round-trips', async () => {
      await db.exec(sql(REFUND_TAX, 'up'));
      await db.exec(sql(REFUND_TAX, 'down'));
      const cols = (
        await db.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name='stripe_refunds' ORDER BY column_name`
        )
      ).rows.map((r: any) => r.column_name);
      expect(cols).toEqual(['amount', 'id', 'order_id', 'status']);
      expect((await db.query(`SELECT amount FROM public.stripe_refunds`)).rows).toEqual([{ amount: '40.00' }]);
      await db.exec(sql(REFUND_TAX, 'down')); // re-runnable
      await db.exec(sql(REFUND_TAX, 'up'));
    });
  });
});
