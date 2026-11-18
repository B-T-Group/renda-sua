/**
 * Applies 20261118180000 on real Postgres. rental_items.currency is an enum,
 * so btrim() must not be in the migration. The updated_at trigger is off for
 * that statement, then on again.
 *
 *   DEDICATED_PG_TEMPLATE=template1 PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=xaf-xof-deposit-migration.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database). The scratch
 * database builds the predecessor tables, then runs the committed up.sql.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATION = '20261118180000_rentals_xaf_xof_zero_deposit';
const suite = TEMPLATE ? describe : describe.skip;
const upSql = readFileSync(
  join(__dirname, '../../../../hasura/migrations/Rendasua', MIGRATION, 'up.sql'),
  'utf8'
);

const STAMP = '2024-01-01T00:00:00.000Z';

const PREDECESSOR = `
  CREATE TYPE public.currency_enum AS ENUM ('XAF', 'XOF', 'CAD', 'USD');
  CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
  RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  CREATE TABLE public.rental_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    currency public.currency_enum NOT NULL
  );
  CREATE TABLE public.rental_location_listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_item_id uuid NOT NULL REFERENCES public.rental_items(id),
    security_deposit_amount numeric(18, 2) NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT NOW()
  );
  CREATE TRIGGER set_public_rental_location_listings_updated_at
    BEFORE UPDATE ON public.rental_location_listings
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
`;

suite('XAF/XOF deposit migration (real Postgres)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_xaf_deposit_${process.pid}_${Date.now()}`;
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Client({ database: dbName });
    await db.connect();
    await db.query(PREDECESSOR);
    await seed(db);
  });

  afterAll(async () => {
    await db?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  it('zeros only XAF and XOF, keeps updated_at, and can run twice', async () => {
    await expect(db.query('SELECT btrim(currency) FROM public.rental_items')).rejects.toThrow(/btrim/);
    await db.query(`BEGIN;\n${upSql}\nCOMMIT;`);
    expect(await deposits(db)).toEqual([
      { currency: 'CAD', deposit: 80, updated_at: new Date(STAMP) },
      { currency: 'USD', deposit: 15, updated_at: new Date(STAMP) },
      { currency: 'XAF', deposit: 0, updated_at: new Date(STAMP) },
      { currency: 'XAF', deposit: 0, updated_at: new Date(STAMP) },
      { currency: 'XOF', deposit: 0, updated_at: new Date(STAMP) },
    ]);

    await db.query(`BEGIN;\n${upSql}\nCOMMIT;`);
    expect((await deposits(db)).map((row) => row.updated_at)).toEqual([
      new Date(STAMP),
      new Date(STAMP),
      new Date(STAMP),
      new Date(STAMP),
      new Date(STAMP),
    ]);

    await db.query(
      `UPDATE public.rental_location_listings AS listing
       SET security_deposit_amount = listing.security_deposit_amount
       FROM public.rental_items AS item
       WHERE listing.rental_item_id = item.id AND item.currency = 'CAD'`
    );
    const cad = (await deposits(db)).find((row) => row.currency === 'CAD');
    expect(cad?.updated_at.getTime()).toBeGreaterThan(new Date(STAMP).getTime());
  });
});

async function seed(db: Client): Promise<void> {
  for (const row of [
    { currency: 'XAF', deposit: 80 },
    { currency: 'XAF', deposit: 0 },
    { currency: 'XOF', deposit: 40 },
    { currency: 'CAD', deposit: 80 },
    { currency: 'USD', deposit: 15 },
  ]) {
    const item = await db.query(
      'INSERT INTO public.rental_items (currency) VALUES ($1::public.currency_enum) RETURNING id',
      [row.currency]
    );
    await db.query(
      `INSERT INTO public.rental_location_listings
         (rental_item_id, security_deposit_amount, updated_at)
       VALUES ($1, $2, $3)`,
      [item.rows[0].id, row.deposit, STAMP]
    );
  }
}

async function deposits(db: Client): Promise<Array<{ currency: string; deposit: number; updated_at: Date }>> {
  const result = await db.query(
    `SELECT item.currency::text AS currency,
            listing.security_deposit_amount::float AS deposit,
            listing.updated_at
     FROM public.rental_location_listings AS listing
     JOIN public.rental_items AS item ON item.id = listing.rental_item_id
     ORDER BY item.currency::text, listing.security_deposit_amount DESC`
  );
  return result.rows;
}
