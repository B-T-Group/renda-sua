import { readFileSync } from 'fs';
import { join } from 'path';

const DIR = join(__dirname, '../../../hasura/migrations/Rendasua/20261029110000_dedicated_posting_created_notice_type');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');

/** user_messages.message_type references message_types by FK: the AC-P13 type must be seeded. */
describe('20261029110000_dedicated_posting_created_notice_type', () => {
  it('seeds DEDICATED_POSTING_CREATED idempotently', () => {
    expect(up).toContain("('DEDICATED_POSTING_CREATED',");
    expect(up).toContain('ON CONFLICT (id) DO NOTHING');
    expect(down).toContain("'DEDICATED_POSTING_CREATED'");
    expect(down).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_messages u WHERE u\.message_type = m\.id\)/);
  });
});
