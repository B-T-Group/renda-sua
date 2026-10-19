import { readFileSync } from 'fs';
import { join } from 'path';
import { DEDICATED_NOTICE_MESSAGE_TYPES } from './dedicated-assignments.service';

const DIR = join(__dirname, '../../../hasura/migrations/Rendasua/20261018190000_dedicated_agents_notice_types');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');

/** The notice rows reference message_types / entity_types by FK: every value the code writes must be seeded. */
describe('20261018190000_dedicated_agents_notice_types', () => {
  it('seeds every message type the assignment notices use, idempotently', () => {
    for (const type of Object.values(DEDICATED_NOTICE_MESSAGE_TYPES)) {
      expect(up).toContain(`('${type}',`);
      expect(down).toContain(`'${type}'`);
    }
    expect(up.match(/ON CONFLICT \(id\) DO NOTHING/g)).toHaveLength(2);
  });

  it('seeds the entity type the notices use', () => {
    expect(up).toContain("('dedicated_agent_assignment',");
    expect(down).toContain("e.id = 'dedicated_agent_assignment'");
  });

  it('down never deletes a type a notice still references', () => {
    expect(down).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_messages u WHERE u\.message_type = m\.id\)/);
    expect(down).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_messages u WHERE u\.entity_type = e\.id\)/);
  });
});
