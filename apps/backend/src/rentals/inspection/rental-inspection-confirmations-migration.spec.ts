import { readFileSync } from 'fs';
import { join } from 'path';

describe('rentals inspection confirmations flag', () => {
  const root = join(__dirname, '../../../..');
  const up = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114120000_rentals_inspection_confirmations/up.sql'),
    'utf8'
  );
  const down = readFileSync(
    join(root, 'hasura/migrations/Rendasua/20261114120000_rentals_inspection_confirmations/down.sql'),
    'utf8'
  );
  const constants = readFileSync(join(root, 'backend/src/app-config/client-flags.constants.ts'), 'utf8');
  const action = readFileSync(join(root, '../.github/actions/apply-hasura/action.yml'), 'utf8');

  it('seeds the flag false and the two in-app message types', () => {
    expect(up).toContain("'rentals_inspection_confirmations_enabled'");
    expect(up).toContain("'RENTAL_STARTED'");
    expect(up).toContain("'RENTAL_CONDITION_REPORT_SENT'");
    expect(up).toMatch(/'boolean', false/);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).not.toContain('NODE_ENV');
    expect(down).toContain('rentals_inspection_confirmations_enabled');
    expect(down).not.toMatch(/DELETE\s+FROM\s+public\.message_types/i);
    expect(down).not.toMatch(/DELETE\s+FROM\s+public\.user_messages/i);
  });

  it('does not turn the flag on from Hasura apply', () => {
    expect(action).not.toContain('rentals_inspection_confirmations_enabled');
  });

  it('defaults false with no environment override', () => {
    expect(constants).toMatch(/rentals_inspection_confirmations_enabled: false/);
    expect(constants).not.toMatch(/rentals_inspection_confirmations_enabled:\s*isNonProduction/);
  });

  it('keeps one in-app notice per booking and event', () => {
    const noticeUp = readFileSync(
      join(root, 'hasura/migrations/Rendasua/20261114133000_rental_notice_idempotency/up.sql'),
      'utf8'
    );
    const noticeDown = readFileSync(
      join(root, 'hasura/migrations/Rendasua/20261114133000_rental_notice_idempotency/down.sql'),
      'utf8'
    );
    expect(noticeUp).toContain('notice_idempotency_key');
    expect(noticeUp).toContain('user_messages_notice_idempotency_key_key UNIQUE');
    expect(noticeDown).toContain('DROP CONSTRAINT IF EXISTS user_messages_notice_idempotency_key_key');
    expect(noticeDown).toContain('DROP COLUMN IF EXISTS notice_idempotency_key');
    expect(noticeDown).not.toMatch(/DELETE\s+FROM\s+public\.message_types/i);
    expect(noticeDown).not.toMatch(/DELETE\s+FROM\s+public\.user_messages/i);
  });

  it('adds the pickup-accepted message type without deleting written notices', () => {
    const noticeUp = readFileSync(
      join(root, 'hasura/migrations/Rendasua/20261114183000_rental_pickup_accepted_notice/up.sql'),
      'utf8'
    );
    const noticeDown = readFileSync(
      join(root, 'hasura/migrations/Rendasua/20261114183000_rental_pickup_accepted_notice/down.sql'),
      'utf8'
    );
    expect(noticeUp).toContain("'RENTAL_PICKUP_ACCEPTED'");
    expect(noticeUp).toContain('ON CONFLICT (id) DO NOTHING');
    expect(noticeDown).toContain('RENTAL_PICKUP_ACCEPTED');
    expect(noticeDown).toContain('NOT EXISTS');
    expect(noticeDown).not.toMatch(/DELETE\s+FROM\s+public\.user_messages/i);
  });
});
