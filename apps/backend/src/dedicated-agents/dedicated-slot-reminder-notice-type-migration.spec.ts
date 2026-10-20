import { readFileSync } from 'fs';
import { join } from 'path';
import { DEDICATED_SLOT_REMINDER_MESSAGE_TYPE } from '../notifications/dedicated-order-push.messages';
import { SLOT_REMINDER_SENDS_PKEY } from '../orders/dedicated-slot-reminder.service';

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

describe('20261018210001_dedicated_slot_reminder_sends (PE: idempotent per agent and slot)', () => {
  const dir = join(__dirname, '../../../hasura/migrations/Rendasua/20261018210001_dedicated_slot_reminder_sends');
  const sendsUp = readFileSync(join(dir, 'up.sql'), 'utf8');
  const sendsDown = readFileSync(join(dir, 'down.sql'), 'utf8');
  const tables = join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables');
  const code = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ');

  it('sets a LOCAL 5 s lock_timeout before any other statement', () => {
    expect(code(sendsUp).trim().split(';')[0].trim()).toBe("SET LOCAL lock_timeout = '5s'");
  });

  it('keys the send on location, slot, date and agent, under the constraint the claim names', () => {
    expect(code(sendsUp)).toContain(
      `CONSTRAINT ${SLOT_REMINDER_SENDS_PKEY} PRIMARY KEY (business_location_id, slot_key, slot_date, agent_id)`
    );
  });

  it('down drops the table', () => {
    expect(code(sendsDown)).toContain('DROP TABLE IF EXISTS public.dedicated_slot_reminder_sends');
  });

  it('is tracked with no role permissions (backend writes only)', () => {
    expect(readFileSync(join(tables, 'tables.yaml'), 'utf8')).toContain('- "!include public_dedicated_slot_reminder_sends.yaml"');
    const meta = readFileSync(join(tables, 'public_dedicated_slot_reminder_sends.yaml'), 'utf8');
    expect(meta).toContain('name: dedicated_slot_reminder_sends');
    expect(meta).not.toMatch(/_permissions/);
  });
});
