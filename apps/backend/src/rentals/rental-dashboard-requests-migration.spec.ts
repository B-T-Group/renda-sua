import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals dashboard requests flag', () => {
  const root = join(__dirname, '../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114143000_rentals_dashboard_requests/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114143000_rentals_dashboard_requests/down.sql'),
    'utf8'
  );
  const constants = readFileSync(join(root, 'backend/src/app-config/client-flags.constants.ts'), 'utf8');
  const action = readFileSync(join(root, '../.github/actions/apply-hasura/action.yml'), 'utf8');

  it('seeds the flag false and the two message types', () => {
    expect(up).toContain("'rentals_dashboard_requests_enabled'");
    expect(up).toContain("'RENTAL_REQUEST_NO_RESPONSE'");
    expect(up).toContain("'RENTAL_REQUEST_EXPIRED'");
    expect(up).toMatch(/'boolean', false/);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).not.toContain('NODE_ENV');
    expect(down).toContain('rentals_dashboard_requests_enabled');
    expect(down).not.toMatch(/DELETE\s+FROM\s+public\.message_types/i);
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_dashboard_requests_enabled');
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_dashboard_requests_enabled: false/);
    expect(constants).not.toMatch(/rentals_dashboard_requests_enabled:\s*isNonProduction/);
  });
});
