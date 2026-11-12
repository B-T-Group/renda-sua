import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals client tab flag', () => {
  const root = join(__dirname, '../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261112160000_rentals_client_tab/up.sql'),
    'utf8'
  );
  const constants = readFileSync(
    join(root, 'backend/src/app-config/client-flags.constants.ts'),
    'utf8'
  );
  const workflow = readFileSync(join(root, '../.github/workflows/hasura-apply.yml'), 'utf8');

  it('inserts the flag off and does not turn it on from Hasura apply', () => {
    expect(up).toContain("'rentals_client_tab_enabled'");
    expect(up).toContain('false');
    expect(up).not.toMatch(/boolean',\s*true/);
    expect(up).not.toContain('NODE_ENV');
    expect(workflow).not.toContain('rentals_client_tab_enabled');
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_client_tab_enabled: false/);
    expect(constants).not.toMatch(/rentals_client_tab_enabled:\s*isNonProduction/);
  });
});
