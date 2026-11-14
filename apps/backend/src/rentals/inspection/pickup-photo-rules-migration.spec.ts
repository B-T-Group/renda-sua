import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals pickup photo rules flag', () => {
  const root = join(__dirname, '../../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114130000_rentals_pickup_photo_rules/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114130000_rentals_pickup_photo_rules/down.sql'),
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
    expect(down).not.toContain('DROP COLUMN IF EXISTS captured_at');
    expect(down).toContain('DROP COLUMN IF EXISTS slot_key');
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_pickup_photo_rules_enabled');
  });

  it('adds nullable capture source columns without turning the flag on', () => {
    const next = readFileSync(
      join(root, 'hasura/migrations/Rendasua/20261114210000_rentals_pickup_photo_capture_source/up.sql'),
      'utf8'
    );
    const nextDown = readFileSync(
      join(root, 'hasura/migrations/Rendasua/20261114210000_rentals_pickup_photo_capture_source/down.sql'),
      'utf8'
    );
    expect(next).toContain('capture_source');
    expect(next).toContain('captured_at_source');
    expect(next).toContain("IN ('camera', 'gallery')");
    expect(next).toContain("IN ('exif', 'upload')");
    expect(next).not.toMatch(/boolean_value\s*=\s*true/);
    expect(nextDown).toContain('DROP COLUMN IF EXISTS capture_source');
    expect(nextDown).not.toMatch(/DROP COLUMN IF EXISTS captured_at(?!_source)/);
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_pickup_photo_rules_enabled: false/);
    expect(constants).not.toMatch(/rentals_pickup_photo_rules_enabled:\s*isNonProduction/);
  });
});
