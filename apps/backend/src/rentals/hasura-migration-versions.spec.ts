import { readdirSync } from 'fs';
import { join } from 'path';

const migrationRoot = join(__dirname, '../../../hasura/migrations/Rendasua');

function duplicateVersions(): string[] {
  const owners = new Map<string, string[]>();
  for (const name of readdirSync(migrationRoot)) {
    const match = /^(\d+)_/.exec(name);
    if (!match) continue;
    const list = owners.get(match[1]) ?? [];
    list.push(name);
    owners.set(match[1], list);
  }
  return [...owners.values()]
    .filter((names) => names.length > 1)
    .map((names) => names.sort().join(', '));
}

describe('Hasura migration versions', () => {
  it('gives every Rendasua migration a unique version prefix', () => {
    expect(duplicateVersions()).toEqual([]);
  });
});
