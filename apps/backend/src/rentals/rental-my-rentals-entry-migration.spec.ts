import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals my rentals entry flag', () => {
  const root = join(__dirname, '../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261112120000_rentals_my_rentals_entry/up.sql'),
    'utf8'
  );
  const seed = readFileSync(join(root, 'hasura/seeds/dev/rentals_my_rentals_entry_on.sql'), 'utf8');
  const workflow = readFileSync(join(root, '../.github/workflows/hasura-apply.yml'), 'utf8');

  it('inserts the flag off and lets only the DEV seed turn it on', () => {
    expect(up).toContain("'rentals_my_rentals_entry_enabled'");
    expect(up).toContain('false');
    expect(up).not.toMatch(/boolean',\s*true/);
    expect(seed).toContain('boolean_value = true');
    expect(seed).toContain('DEV ONLY');
  });

  it('runs that seed from the dev job and not from production', () => {
    const dev = workflow.slice(workflow.indexOf('apply-hasura-dev:'), workflow.indexOf('apply-hasura-production:'));
    const prod = workflow.slice(workflow.indexOf('apply-hasura-production:'));
    expect(dev).toContain('rentals_my_rentals_entry_on.sql');
    expect(prod).not.toContain('rentals_my_rentals_entry_on.sql');
  });
});