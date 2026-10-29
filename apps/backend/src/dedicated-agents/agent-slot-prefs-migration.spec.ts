import { readFileSync } from 'fs';
import { join } from 'path';
import { DEDICATED_PAUSE_REASONS } from './dedicated-agents.constants';

const DIR = join(__dirname, '../../../hasura/migrations/Rendasua/20261029100000_agent_preferred_slots');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');
const META = join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables');

describe('20261029100000_agent_preferred_slots', () => {
  it.each(['pref_morning', 'pref_afternoon', 'pref_evening'])('%s is NOT NULL DEFAULT true and backfilled', (col) => {
    expect(up).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col} boolean NOT NULL DEFAULT true`));
    expect(up).toMatch(new RegExp(`SET[\\s\\S]*${col} = true`));
    expect(down).toMatch(new RegExp(`DROP COLUMN IF EXISTS ${col}`));
  });

  it('pause_reason is nullable and checked against the code list', () => {
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS pause_reason text;/);
    for (const r of DEDICATED_PAUSE_REASONS) expect(up).toContain(`'${r}'`);
    expect(down).toMatch(/DROP CONSTRAINT IF EXISTS dedicated_agent_assignments_pause_reason_check/);
    expect(down).toMatch(/DROP COLUMN IF EXISTS pause_reason/);
  });

  it('agents can read their prefs; agent and business can read pause_reason; no new write grants', () => {
    const agents = readFileSync(join(META, 'public_agents.yaml'), 'utf8');
    const sel = agents.slice(agents.indexOf('select_permissions:'), agents.indexOf('update_permissions:'));
    expect(sel).toContain('- pref_morning');
    const upd = agents.slice(agents.indexOf('update_permissions:'));
    expect(upd).not.toContain('pref_');
    const asg = readFileSync(join(META, 'public_dedicated_agent_assignments.yaml'), 'utf8');
    expect(asg.match(/- pause_reason/g)?.length).toBe(2);
  });
});
