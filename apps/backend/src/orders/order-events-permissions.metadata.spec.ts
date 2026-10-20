import { readFileSync } from 'fs';
import { join } from 'path';
import { ADMIN_CANCEL_PROGRESS_EVENT } from './admin-cancel-progress';

const FILE = join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables/public_order_events.yaml');

/**
 * #627 nit: the admin cancel progress row (leases, step states, admin id, notes) is
 * internal. No user role may read it through order_events.
 */
describe('order_events user-role reads exclude admin_cancel_progress', () => {
  const yaml = readFileSync(FILE, 'utf8');
  const select = yaml.slice(yaml.indexOf('select_permissions:'));
  const blocks = select.split('\n  - role: ').slice(1);
  const roleOf = (b: string) => b.split('\n')[0].trim();

  it('the marker event type on main is admin_cancel_progress', () => {
    expect(ADMIN_CANCEL_PROGRESS_EVENT).toBe('admin_cancel_progress');
  });

  it('agent, business and client are the only user roles that read order_events', () => {
    expect(blocks.map(roleOf).sort()).toEqual(['agent', 'business', 'client']);
  });

  it.each(['agent', 'business', 'client'])('%s: own orders only AND event_type not the marker', (role) => {
    const b = blocks.find((x) => roleOf(x) === role) ?? '';
    const filter = b.slice(b.indexOf('      filter:'));
    expect(filter).toMatch(/^ {6}filter:\n {8}_and:\n/);
    expect(filter).toContain('_eq: X-Hasura-User-Id');
    expect(filter).toContain(
      `          - event_type:\n              _nin:\n                - ${ADMIN_CANCEL_PROGRESS_EVENT}`
    );
  });

  it('no user role can write order_events', () => {
    expect(yaml).not.toMatch(/^(insert|update|delete)_permissions:/m);
  });
});
