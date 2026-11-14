import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals card window guard flag', () => {
  const root = join(__dirname, '../../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261113180000_rentals_card_window_guard/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261113180000_rentals_card_window_guard/down.sql'),
    'utf8'
  );
  const constants = readFileSync(join(root, 'backend/src/app-config/client-flags.constants.ts'), 'utf8');
  const action = readFileSync(join(root, '../.github/actions/apply-hasura/action.yml'), 'utf8');

  it('seeds the global flag false and does not turn it on', () => {
    expect(up).toContain("'rentals_card_window_guard_enabled'");
    expect(up).toContain("'rentals_card_charge_at_pickup_enabled'");
    expect(up.match(/'boolean', false/g)).toHaveLength(2);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).not.toContain('NODE_ENV');
    expect(down).toContain('rentals_card_window_guard_enabled');
    expect(down).toContain('rentals_card_charge_at_pickup_enabled');
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_card_window_guard_enabled');
    expect(action).not.toContain('rentals_card_charge_at_pickup_enabled');
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_card_window_guard_enabled: false/);
    expect(constants).not.toMatch(/rentals_card_window_guard_enabled:\s*isNonProduction/);
  });
});
