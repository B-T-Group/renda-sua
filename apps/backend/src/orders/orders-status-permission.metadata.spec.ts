/**
 * #627 C5 (HIGH): orders.current_status is written only by the backend (admin secret,
 * through OrderStatusService's compare-and-set transition rules) and by the Lambdas
 * (admin secret). No Hasura user role may set it: the agent / business update
 * permissions had it in `columns` with `check: null`, so any agent or business JWT
 * could move its order to any status (e.g. shipped -> pending, then cancel or refund),
 * with no DB trigger validating the transition.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const CANDIDATES = [
  join(process.cwd(), 'apps/hasura/metadata/databases/Rendasua/tables/public_orders.yaml'),
  join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables/public_orders.yaml'),
];

function updatePermissions(): Array<{ role: string; columns: string[] }> {
  const path = CANDIDATES.find((p) => existsSync(p));
  if (!path) throw new Error('public_orders.yaml not found');
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf('\nupdate_permissions:\n');
  expect(start).toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n[a-z_]+:\n/);
  const section = next === -1 ? rest : rest.slice(0, next + 1);
  return section
    .split(/\n {2}- role: /)
    .slice(1)
    .map((block) => {
      const role = block.split('\n')[0].trim();
      const cols = /\n {6}columns:\n((?: {8}- .*\n)+)/.exec(block + '\n');
      const columns = cols ? cols[1].split('\n').map((l) => l.replace(/^\s*- /, '').trim()).filter(Boolean) : [];
      return { role, columns };
    });
}

describe('orders update permissions (Hasura metadata)', () => {
  it('parses the agent, business and client update permissions', () => {
    const roles = updatePermissions().map((p) => p.role).sort();
    expect(roles).toEqual(['agent', 'business', 'client']);
    // The parser really reads the column lists (guards against a vacuous pass).
    const business = updatePermissions().find((p) => p.role === 'business');
    expect(business?.columns).toContain('estimated_delivery_time');
  });

  it('no user role can update orders.current_status', () => {
    for (const p of updatePermissions()) {
      expect([p.role, p.columns.includes('current_status')]).toEqual([p.role, false]);
    }
  });
});
