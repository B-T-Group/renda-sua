import { readFileSync } from 'fs';
import { join } from 'path';

describe('rental request edit wall-clock migration', () => {
  const dir = join(__dirname, '../../../hasura/migrations/Rendasua/20261126170000_rental_request_edit_wall_clock_now');
  const up = readFileSync(join(dir, 'up.sql'), 'utf8');
  const down = readFileSync(join(dir, 'down.sql'), 'utf8');

  it('keeps the 11-argument signature so callers resolve to one overload', () => {
    for (const sql of [up, down]) {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.apply_rental_request_edit(');
      expect(sql).toContain('p_confirmed_currency text DEFAULT NULL');
    }
  });

  it('reads p_now on the listing wall clock for the 2-hour edit window only', () => {
    expect(up).toContain('public.rental_listing_time_zone(public.rental_booking_country(v_listing))');
    expect(up).toContain("v_start <= v_now_wall + interval '2 hours'");
    expect(up).toContain("v_new_start <= v_now_wall + interval '2 hours'");
    expect(up).toContain("v_respond_by := p_now + interval '24 hours'");
    expect(down).toContain("v_start <= p_now + interval '2 hours'");
    expect(down).not.toContain('v_now_wall');
  });
});
