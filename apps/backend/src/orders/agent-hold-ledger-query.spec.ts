import { AGENT_HOLD_LEDGER_QUERY } from './order-reassignment.service';

jest.mock('../notifications/notifications.service', () => ({ NotificationsService: class NotificationsService {} }));

describe('AGENT_HOLD_LEDGER_QUERY (QA F2)', () => {
  it('counts a forfeit as no longer held (releases list = release + forfeit rows)', () => {
    const releases = /releases: account_transactions\(\s*where: \{([^\n]*)\}\s*\)/.exec(AGENT_HOLD_LEDGER_QUERY)?.[1] ?? '';
    expect(releases).toContain('transaction_type: { _in: [release, forfeit] }');
    const holds = /holds: account_transactions\(\s*where: \{([^\n]*)\}\s*\)/.exec(AGENT_HOLD_LEDGER_QUERY)?.[1] ?? '';
    expect(holds).toContain('transaction_type: { _eq: hold }');
  });
});
