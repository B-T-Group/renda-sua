import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals my rentals entry flag', () => {
  const root = join(__dirname, '../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261112120000_rentals_my_rentals_entry/up.sql'),
    'utf8'
  );
  const workflow = readFileSync(join(root, '../.github/workflows/hasura-apply.yml'), 'utf8');

  it('inserts the flag off and does not turn it on from Hasura apply', () => {
    expect(up).toContain("'rentals_my_rentals_entry_enabled'");
    expect(up).toContain('false');
    expect(up).not.toMatch(/boolean',\s*true/);
    expect(workflow).not.toContain('rentals_my_rentals_entry_on.sql');
    expect(workflow).not.toContain('Enable rentals_my_rentals_entry_enabled on DEV');
  });
});