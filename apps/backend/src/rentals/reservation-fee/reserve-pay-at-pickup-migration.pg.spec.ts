/**
 * Applies 20261126230000_rental_reserve_pay_at_pickup on real Postgres:
 * fee columns default to "no fee", the fee cannot exceed the total, and the
 * paid-start trigger refuses confirmed -> active while unpaid.
 *
 *   DEDICATED_PG_TEMPLATE=template1 PGHOST=/var/run/postgresql \
 *     npx nx test backend --testPathPattern=reserve-pay-at-pickup-migration.pg
 *
 * Skipped when DEDICATED_PG_TEMPLATE is unset (CI has no database).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const TEMPLATE = process.env.DEDICATED_PG_TEMPLATE?.trim();
const MIGRATION = '20261126230000_rental_reserve_pay_at_pickup';
const suite = TEMPLATE ? describe : describe.skip;
const dir = join(__dirname, '../../../../hasura/migrations/Rendasua', MIGRATION);
const upSql = readFileSync(join(dir, 'up.sql'), 'utf8');
const downSql = readFileSync(join(dir, 'down.sql'), 'utf8');

const PREDECESSOR = `
  CREATE TYPE public.order_deposit_status_enum AS ENUM ('none', 'pending', 'paid', 'failed', 'forfeited', 'refunded');
  ALTER TYPE public.order_deposit_status_enum ADD VALUE 'applied';
  CREATE TYPE public.rental_booking_status_enum AS ENUM ('proposed', 'reserved', 'confirmed', 'active', 'awaiting_return', 'completed', 'cancelled');
  CREATE TYPE public.rental_booking_payment_status_enum AS ENUM ('pending', 'authorized', 'paid', 'cancelled');
  CREATE TABLE public.rental_location_listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE public.rental_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status public.rental_booking_status_enum NOT NULL,
    payment_status public.rental_booking_payment_status_enum NOT NULL DEFAULT 'pending',
    total_amount numeric(18, 2) NOT NULL
  );
`;

suite('reserve now, pay at pickup migration (real Postgres)', () => {
  jest.setTimeout(60_000);
  const dbName = `rs_reserve_pap_${process.pid}_${Date.now()}`;
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    admin = new Client({ database: 'postgres' });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Client({ database: dbName });
    await db.connect();
    await db.query(PREDECESSOR);
    await db.query(`INSERT INTO public.rental_bookings (status, payment_status, total_amount) VALUES ('confirmed', 'authorized', 60)`);
    await db.query(`INSERT INTO public.rental_location_listings DEFAULT VALUES`);
  });

  afterAll(async () => {
    await db?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  it('adds the columns with no-fee defaults and runs twice', async () => {
    await db.query(`BEGIN;\n${upSql}\nCOMMIT;`);
    await db.query(`BEGIN;\n${upSql}\nCOMMIT;`);
    const booking = await db.query(
      `SELECT card_pay_at_pickup, reservation_fee_amount::float AS fee, reservation_fee_status::text AS status FROM public.rental_bookings`
    );
    expect(booking.rows).toEqual([{ card_pay_at_pickup: false, fee: 0, status: 'none' }]);
    const listing = await db.query(`SELECT reservation_fee_enabled FROM public.rental_location_listings`);
    expect(listing.rows).toEqual([{ reservation_fee_enabled: false }]);
  });

  it('refuses a fee above the total and an unknown rail', async () => {
    await expect(db.query(`UPDATE public.rental_bookings SET reservation_fee_amount = 61`)).rejects.toThrow(/reservation_fee_nonneg/);
    await expect(db.query(`UPDATE public.rental_bookings SET reservation_fee_rail = 'cash'`)).rejects.toThrow(/reservation_fee_rail/);
    await db.query(`UPDATE public.rental_bookings SET reservation_fee_amount = 6, reservation_fee_rail = 'card', reservation_fee_status = 'paid'`);
  });

  it('starts a paid booking and refuses an unpaid one', async () => {
    await db.query(`INSERT INTO public.rental_bookings (status, payment_status, total_amount) VALUES ('confirmed', 'pending', 100)`);
    await expect(
      db.query(`UPDATE public.rental_bookings SET status = 'active' WHERE payment_status = 'pending'`)
    ).rejects.toThrow(/rental_start_unpaid/);
    await db.query(`UPDATE public.rental_bookings SET status = 'active' WHERE payment_status = 'authorized'`);
    // Other moves of an unpaid booking are untouched.
    await db.query(`UPDATE public.rental_bookings SET status = 'cancelled' WHERE payment_status = 'pending'`);
    const rows = await db.query(`SELECT status::text AS status FROM public.rental_bookings ORDER BY total_amount`);
    expect(rows.rows).toEqual([{ status: 'active' }, { status: 'cancelled' }]);
  });

  it('down removes everything it added', async () => {
    await db.query(`BEGIN;\n${downSql}\nCOMMIT;`);
    const cols = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'rental_bookings' AND column_name LIKE 'reservation_fee%'`
    );
    expect(cols.rows).toEqual([]);
  });
});
