import { readFileSync } from 'fs';
import { join } from 'path';
import { DEDICATED_SLOT_REMINDER_MESSAGE_TYPE } from '../notifications/dedicated-order-push.messages';

const DIR = join(__dirname, '../../../hasura/migrations/Rendasua/20261018210000_dedicated_slot_reminder_notice_type');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');

/** user_messages.message_type references message_types by FK: the PR 6 reminder type must be seeded. */
describe('20261018210000_dedicated_slot_reminder_notice_type', () => {
  it('seeds the slot reminder type idempotently', () => {
    expect(up).toContain(`('${DEDICATED_SLOT_REMINDER_MESSAGE_TYPE}',`);
    expect(up).toContain('ON CONFLICT (id) DO NOTHING');
    expect(down).toContain(`'${DEDICATED_SLOT_REMINDER_MESSAGE_TYPE}'`);
  });

  it('down never deletes a type a notice still references', () => {
    expect(down).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_messages u WHERE u\.message_type = m\.id\)/);
  });
});
