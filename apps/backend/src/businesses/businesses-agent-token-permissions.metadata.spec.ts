import { readFileSync } from 'fs';
import { join } from 'path';

const FILE = join(
  __dirname,
  '../../../hasura/metadata/databases/Rendasua/tables/public_businesses.yaml'
);

/**
 * #665: agent (and every other non-owner role) must not select AI token
 * balances. The agent filter is open, so the column list is the only guard.
 */
describe('businesses select permissions hide AI token balances from non-owners', () => {
  const yaml = readFileSync(FILE, 'utf8');
  const select = yaml.slice(yaml.indexOf('\nselect_permissions:'));
  const untilUpdate = select.split('\nupdate_permissions:')[0];
  const blocks = untilUpdate.split('\n  - role: ').slice(1);

  function columns(block: string): string[] {
    const lines = block.split('\n');
    const start = lines.findIndex((line) => line.trim() === 'columns:');
    const cols: string[] = [];
    for (const line of lines.slice(start + 1)) {
      const match = line.match(/^\s+- ([a-z0-9_]+)\s*$/);
      if (!match) break;
      cols.push(match[1]);
    }
    return cols;
  }

  it('lets only the business role read ai_tokens and ai_reel_tokens, on its own row', () => {
    const roles = blocks.map((block) => block.split('\n')[0].trim());
    expect(roles).toEqual(expect.arrayContaining(['agent', 'anonymous', 'business', 'client']));

    for (const block of blocks) {
      const role = block.split('\n')[0].trim();
      const cols = columns(block);
      if (role === 'business') {
        expect(cols).toEqual(expect.arrayContaining(['ai_tokens', 'ai_reel_tokens']));
        expect(block).toContain('_eq: X-Hasura-User-Id');
      } else {
        expect(cols).not.toContain('ai_tokens');
        expect(cols).not.toContain('ai_reel_tokens');
      }
    }
  });
});
