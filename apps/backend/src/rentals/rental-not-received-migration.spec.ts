import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals not-received report flag', () => {
  const root = join(__dirname, '../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261112233000_rental_not_received_reports/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261112233000_rental_not_received_reports/down.sql'),
    'utf8'
  );
  const constants = readFileSync(join(root, 'backend/src/app-config/client-flags.constants.ts'), 'utf8');
  const action = readFileSync(join(root, '../.github/actions/apply-hasura/action.yml'), 'utf8');

  it('inserts the flag false and creates one report per booking', () => {
    expect(up).toContain('CREATE TABLE IF NOT EXISTS public.rental_not_received_reports');
    expect(up).toContain('rental_not_received_reports_booking_uidx');
    expect(up).toContain("'RENTAL_NOT_RECEIVED'");
    expect(up).toContain("'rentals_not_received_report_enabled'");
    expect(up).toMatch(/'boolean', false/);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).not.toContain('NODE_ENV');
    expect(down).toContain('DROP TABLE IF EXISTS public.rental_not_received_reports');
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_not_received_report_enabled');
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_not_received_report_enabled: false/);
    expect(constants).not.toMatch(/rentals_not_received_report_enabled:\s*isNonProduction/);
  });
});
