import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals default list flag', () => {
  it('seeds the flag off with no production override', () => {
    const up = readFileSync(
      join(__dirname, '../../../hasura/migrations/Rendasua/20261119170000_rentals_default_list/up.sql'),
      'utf8'
    );
    const constants = readFileSync(join(__dirname, '../app-config/client-flags.constants.ts'), 'utf8');
    expect(up).toContain("'rentals_default_list_enabled'");
    expect(up).toContain('false');
    expect(constants).toMatch(/rentals_default_list_enabled: false/);
    expect(constants).not.toMatch(/rentals_default_list_enabled:\s*isNonProduction/);
    expect(constants).toContain("'rentals_default_list_enabled'");
  });
});
