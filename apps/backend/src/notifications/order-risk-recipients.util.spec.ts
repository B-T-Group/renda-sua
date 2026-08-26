import { buildOrderRiskRecipients } from './order-risk-recipients.util';

const STAFF = [
  {
    userId: 'super-1',
    email: 'super@rendasua.com',
    preferredLanguage: 'fr',
    roles: ['superuser'],
  },
  {
    userId: 'ops-1',
    email: 'ops@rendasua.com',
    preferredLanguage: 'en',
    roles: ['order_manager'],
  },
  { userId: 'money-1', email: 'money@rendasua.com', roles: ['finance'] },
];

const ROLE_KEYS = ['superuser', 'order_manager'];

describe('buildOrderRiskRecipients', () => {
  it('alerts superusers and order managers, but not other platform staff', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
    });
    expect(recipients.map((r) => r.userId)).toEqual(['super-1', 'ops-1']);
  });

  it('adds the agent who referred the merchant', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
      referringAgentUserId: 'agent-9',
    });
    expect(recipients).toContainEqual({
      userId: 'agent-9',
      email: null,
      preferredLanguage: null,
    });
  });

  it('carries each recipient language so Meta gets the right translation', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
      referringAgentUserId: 'agent-9',
      referringAgentLanguage: 'fr',
    });
    expect(
      recipients.map((r) => [r.userId, r.preferredLanguage])
    ).toEqual([
      ['super-1', 'fr'],
      ['ops-1', 'en'],
      ['agent-9', 'fr'],
    ]);
  });

  it('leaves the referring agent without an email so only push and WhatsApp go out', () => {
    const [agent] = buildOrderRiskRecipients({
      staff: [],
      roleKeys: ROLE_KEYS,
      referringAgentUserId: 'agent-9',
    });
    expect(agent.email).toBeNull();
  });

  it('never notifies the same person twice when the referrer is also staff', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
      referringAgentUserId: 'ops-1',
    });
    expect(recipients.filter((r) => r.userId === 'ops-1')).toEqual([
      { userId: 'ops-1', email: 'ops@rendasua.com', preferredLanguage: 'en' },
    ]);
  });

  it('ignores a missing or blank referrer', () => {
    expect(
      buildOrderRiskRecipients({
        staff: STAFF,
        roleKeys: ROLE_KEYS,
        referringAgentUserId: '  ',
      })
    ).toHaveLength(2);
    expect(
      buildOrderRiskRecipients({
        staff: STAFF,
        roleKeys: ROLE_KEYS,
        referringAgentUserId: null,
      })
    ).toHaveLength(2);
  });
});
