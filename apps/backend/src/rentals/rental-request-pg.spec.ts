import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const url = process.env.RENTAL_QA_DATABASE_URL || 'postgres://rental_qa:rental_qa@127.0.0.1:5432/rental_qa';
const root = join(__dirname, '../../../hasura/migrations/Rendasua');

const schema = `
CREATE TABLE public.rental_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  rental_location_listing_id uuid NOT NULL,
  requested_start_at timestamptz NOT NULL,
  requested_end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT timezone('UTC', now()),
  rental_selection_windows jsonb,
  respond_by timestamptz
);
CREATE TABLE public.rental_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id uuid NOT NULL,
  status text NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  contract_expires_at timestamptz
);
CREATE TABLE public.rental_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL,
  status text NOT NULL,
  previous_status text,
  changed_by_type text NOT NULL,
  notes text
);
CREATE TABLE public.application_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text,
  config_name text,
  description text,
  data_type text,
  string_value text,
  boolean_value boolean,
  country_code text,
  status text,
  version integer,
  tags text[]
);
INSERT INTO public.application_configurations (config_key, boolean_value, status, country_code, data_type)
VALUES ('rentals_dashboard_requests_enabled', true, 'active', 'CM', 'boolean');
`;

describe('rental request SQL on Postgres', () => {
  const client = new Client({ connectionString: url });

  beforeAll(async () => {
    await client.connect();
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await client.query(schema);
    await client.query(readFileSync(join(root, '20261114200000_rental_requests_respond_by_index/up.sql'), 'utf8'));
    await client.query(readFileSync(join(root, '20261118210000_rental_request_qa_round2/up.sql'), 'utf8'));
  });

  afterAll(async () => {
    await client.end();
  });

  it('N3 skips a malformed windows value instead of aborting', async () => {
    const created = '2026-11-01T00:00:00Z';
    const cases = [
      null,
      'null',
      '{"not":"array"}',
      '"2026-11-31T10:00:00Z"',
      '[{"start_at":"2026-11-31T10:00:00Z"}]',
    ];
    for (const windows of cases) {
      const result = await client.query(
        'SELECT public.rental_request_respond_by($1::timestamptz, $2::timestamptz, $3::jsonb) AS respond_by',
        [created, '2026-12-01T00:00:00Z', windows]
      );
      expect(result.rows[0].respond_by.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    }
    const valid = await client.query(
      'SELECT public.rental_request_respond_by($1::timestamptz, NULL, $2::jsonb) AS respond_by',
      [created, '[{"start_at":"2026-11-01T06:00:00Z"}]']
    );
    expect(valid.rows[0].respond_by.toISOString()).toBe('2026-11-01T06:00:00.000Z');
  });

  it('N1 sets respond_by on insert and the expiry predicate can see the row', async () => {
    const inserted = await client.query(
      `INSERT INTO public.rental_requests (
         client_id, rental_location_listing_id, requested_start_at, requested_end_at, rental_selection_windows
       ) VALUES (
         gen_random_uuid(), gen_random_uuid(), $1::timestamptz, $2::timestamptz, $3::jsonb
       ) RETURNING id, respond_by`,
      ['2026-11-01T08:00:00Z', '2026-11-02T08:00:00Z', '[{"start_at":"2026-11-01T08:00:00Z"}]']
    );
    expect(inserted.rows[0].respond_by.toISOString()).toBe('2026-11-01T08:00:00.000Z');
    const due = await client.query(
      `SELECT id FROM public.rental_requests
        WHERE status = 'pending' AND respond_by <= timezone('UTC', now()) AND id = $1`,
      [inserted.rows[0].id]
    );
    expect(due.rows).toHaveLength(1);
  });

  it('N2 cancels the request and writes booking history', async () => {
    const clientId = '11111111-1111-4111-8111-111111111111';
    const request = await client.query(
      `INSERT INTO public.rental_requests (
         client_id, rental_location_listing_id, requested_start_at, requested_end_at, status
       ) VALUES ($1, gen_random_uuid(), now() + interval '2 days', now() + interval '3 days', 'pending')
       RETURNING id`,
      [clientId]
    );
    const requestId = request.rows[0].id;
    await client.query(
      `INSERT INTO public.rental_bookings (rental_request_id, status, payment_status)
       VALUES ($1, 'proposed', 'pending')`,
      [requestId]
    );
    const cancelled = await client.query(
      'SELECT id, status FROM public.cancel_client_rental_request($1, $2)',
      [requestId, clientId]
    );
    expect(cancelled.rows[0]).toMatchObject({ id: requestId, status: 'cancelled' });
    const booking = await client.query(
      'SELECT status, payment_status FROM public.rental_bookings WHERE rental_request_id = $1',
      [requestId]
    );
    expect(booking.rows[0]).toMatchObject({ status: 'cancelled', payment_status: 'cancelled' });
    const history = await client.query(
      `SELECT h.status, h.previous_status, h.changed_by_type, h.notes
         FROM public.rental_status_history h
         JOIN public.rental_bookings b ON b.id = h.rental_booking_id
        WHERE b.rental_request_id = $1`,
      [requestId]
    );
    expect(history.rows[0].previous_status).toBe('proposed');
    expect(history.rows[0].notes).toContain('withdrew');
    await expect(client.query('SELECT * FROM public.cancel_client_rental_request($1, $2)', [requestId, clientId])).rejects.toThrow(/rental_request_not_pending/);
  });

  it('N6 writes the cutoff when the flag is already on', async () => {
    const since = await client.query(
      `SELECT country_code, string_value FROM public.application_configurations
        WHERE config_key = 'rentals_dashboard_requests_autodecline_since'`
    );
    expect(since.rows).toEqual([expect.objectContaining({ country_code: 'CM' })]);
    expect(since.rows[0].string_value).toMatch(/Z$/);
  });
});
