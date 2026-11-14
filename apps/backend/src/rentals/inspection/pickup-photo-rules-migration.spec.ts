import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals pickup photo rules flag', () => {
  const root = join(__dirname, '../../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114120000_rentals_pickup_photo_rules/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114120000_rentals_pickup_photo_rules/down.sql'),
    'utf8'
  );
  const constants = readFileSync(join(root, 'backend/src/app-config/client-flags.constants.ts'), 'utf8');
  const action = readFileSync(join(root, '../.github/actions/apply-hasura/action.yml'), 'utf8');

  it('inserts the flag false and adds the server capture stamp', () => {
    expect(up).toContain('captured_at');
    expect(up).toContain('rental_inspection_slot_skips');
    expect(up).toContain("'rentals_pickup_photo_rules_enabled'");
    expect(up).toMatch(/'boolean', false/);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).not.toContain('NODE_ENV');
    expect(down).toContain('DROP TABLE IF EXISTS public.rental_inspection_slot_skips');
    expect(down).toContain('DROP COLUMN IF EXISTS captured_at');
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_pickup_photo_rules_enabled');
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_pickup_photo_rules_enabled: false/);
    expect(constants).not.toMatch(/rentals_pickup_photo_rules_enabled:\s*isNonProduction/);
  });
});
