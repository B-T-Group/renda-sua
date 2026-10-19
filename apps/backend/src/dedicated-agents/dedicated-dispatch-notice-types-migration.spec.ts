import { readFileSync } from 'fs';
import { join } from 'path';
import { DEDICATED_ORDER_MESSAGE_TYPES } from '../notifications/dedicated-order-push.messages';

const DIR = join(__dirname, '../../../hasura/migrations/Rendasua/20261018200000_dedicated_dispatch_notice_types');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');

/** user_messages.message_type references message_types by FK: every PR 5 value must be seeded. */
describe('20261018200000_dedicated_dispatch_notice_types', () => {
  it('seeds every message type the dispatch notices use, idempotently', () => {
    for (const type of Object.values(DEDICATED_ORDER_MESSAGE_TYPES)) {
      expect(up).toContain(`('${type}',`);
      expect(down).toContain(`'${type}'`);
    }
    expect(up).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('down never deletes a type a notice still references', () => {
    expect(down).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_messages u WHERE u\.message_type = m\.id\)/);
  });
});
