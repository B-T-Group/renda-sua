import { readFileSync } from 'fs';
import { join } from 'path';
import { RENTAL_HELD_STATUSES, RENTAL_PROPOSED_STATUS } from './rental-capacity';

describe('rental search migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../../hasura/migrations/Rendasua/20261110140000_rental_search_first/up.sql'),
    'utf8'
  );

  it('holds the same booking statuses booking enforcement uses', () => {
    for (const status of RENTAL_HELD_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toContain(`'${RENTAL_PROPOSED_STATUS}'`);
    expect(sql).toContain('contract_expires_at');
  });

  it('does not treat inspection slots as inventory', () => {
    const peak = sql.slice(sql.indexOf('FUNCTION public.rental_peak_units_held'), sql.indexOf('rental_claim_availability_for_listing'));
    expect(peak).toContain('units_booked');
    expect(peak).not.toContain('rental_booking_units');
    expect(sql).toContain('rental_booking_units are inspection labels');
    expect(sql).toContain('rental_dates_open');
    expect(sql).toContain('is_storefront_visible');
    expect(sql).toContain('rental_availability_scan');
  });

  it('indexes titles and categories with pg_trgm and claims each subscription once', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    expect(sql).toContain('gin_trgm_ops');
    expect(sql).toContain('rental_items_name_trgm');
    expect(sql).toContain('rental_categories_name_trgm');
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('ON CONFLICT (subscription_id) DO NOTHING');
    expect(sql).toContain('rentals_search_first_enabled');
  });
});
