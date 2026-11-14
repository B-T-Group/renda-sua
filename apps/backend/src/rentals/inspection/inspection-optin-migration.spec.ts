import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../../../hasura/migrations/Rendasua/20261114220000_rentals_inspection_optin');

describe('inspection opt-in migration', () => {
  const up = readFileSync(join(root, 'up.sql'), 'utf8');
  const down = readFileSync(join(root, 'down.sql'), 'utf8');
  const constants = readFileSync(join(__dirname, '../../app-config/client-flags.constants.ts'), 'utf8');

  it('seeds the flag false and does not turn pickup photo rules on', () => {
    expect(up).toContain("'rentals_inspection_optin_enabled'");
    expect(up).toContain("'boolean', false, NULL, 'active'");
    expect(up).not.toContain('rentals_pickup_photo_rules_enabled');
    expect(up).toContain('inspection_opt_in boolean NOT NULL DEFAULT false');
    expect(constants).toMatch(/rentals_inspection_optin_enabled: false/);
    expect(constants).not.toMatch(/rentals_inspection_optin_enabled:\s*isNonProduction/);
  });

  it('drops only the columns this migration adds', () => {
    expect(down).toContain('DROP TABLE IF EXISTS public.rental_item_baseline_photos');
    expect(down).toContain('DROP COLUMN IF EXISTS inspection_opt_in');
    expect(down).toContain('rentals_inspection_optin_enabled');
  });
});
