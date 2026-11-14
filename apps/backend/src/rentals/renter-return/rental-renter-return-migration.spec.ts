import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals renter return report flag', () => {
  const root = join(__dirname, '../../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261113160000_rental_renter_return_report/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261113160000_rental_renter_return_report/down.sql'),
    'utf8'
  );
  const constants = readFileSync(join(root, 'backend/src/app-config/client-flags.constants.ts'), 'utf8');
  const action = readFileSync(join(root, '../.github/actions/apply-hasura/action.yml'), 'utf8');

  it('inserts the flag false and adds the report timestamp', () => {
    expect(up).toContain('renter_reported_returned_at');
    expect(up).toContain('renter_return_escalated_at');
    expect(up).toContain("'RENTAL_RENTER_RETURN_REPORTED'");
    expect(up).toContain("'rentals_renter_return_report_enabled'");
    expect(up).toMatch(/'boolean', false/);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).not.toContain('NODE_ENV');
    expect(down).toContain('DROP COLUMN IF EXISTS renter_reported_returned_at');
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_renter_return_report_enabled');
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_renter_return_report_enabled: false/);
    expect(constants).not.toMatch(/rentals_renter_return_report_enabled:\s*isNonProduction/);
  });
});
