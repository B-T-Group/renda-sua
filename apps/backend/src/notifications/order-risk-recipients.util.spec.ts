import {
  buildOrderRiskRecipients,
  staffMatchesOrderCountry,
} from './order-risk-recipients.util';

const STAFF = [
  {
    userId: 'super-1',
    email: 'super@rendasua.com',
    preferredLanguage: 'fr',
    country: 'CM',
    roles: ['superuser'],
  },
  {
    userId: 'ops-1',
    email: 'ops@rendasua.com',
    preferredLanguage: 'en',
    country: 'CM',
    roles: ['order_manager'],
  },
  {
    userId: 'super-ga',
    email: 'ga@rendasua.com',
    preferredLanguage: 'fr',
    country: 'GA',
    roles: ['superuser'],
  },
  {
    userId: 'super-global',
    email: 'global@rendasua.com',
    preferredLanguage: 'en',
    country: null,
    roles: ['superuser'],
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
    expect(recipients.map((r) => r.userId)).toEqual([
      'super-1',
      'ops-1',
      'super-ga',
      'super-global',
    ]);
  });

  it('keeps same-country staff and always includes null-country global ops', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
      orderCountryCode: 'cm',
    });
    expect(recipients.map((r) => r.userId)).toEqual([
      'super-1',
      'ops-1',
      'super-global',
    ]);
  });

  it('never pages staff in a different country', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
      orderCountryCode: 'GA',
    });
    expect(recipients.map((r) => r.userId)).toEqual([
      'super-ga',
      'super-global',
    ]);
  });

  it('falls back to all matching roles when the order has no country', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
      orderCountryCode: null,
    });
    expect(recipients.map((r) => r.userId)).toEqual([
      'super-1',
      'ops-1',
      'super-ga',
      'super-global',
    ]);
  });

  it('adds the agent who referred the merchant', () => {
    const recipients = buildOrderRiskRecipients({
      staff: STAFF,
      roleKeys: ROLE_KEYS,
      orderCountryCode: 'CM',
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
      orderCountryCode: 'CM',
      referringAgentUserId: 'agent-9',
      referringAgentLanguage: 'fr',
    });
    expect(
      recipients.map((r) => [r.userId, r.preferredLanguage])
    ).toEqual([
      ['super-1', 'fr'],
      ['ops-1', 'en'],
      ['super-global', 'en'],
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
      orderCountryCode: 'CM',
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
        orderCountryCode: 'CM',
        referringAgentUserId: '  ',
      })
    ).toHaveLength(3);
    expect(
      buildOrderRiskRecipients({
        staff: STAFF,
        roleKeys: ROLE_KEYS,
        orderCountryCode: 'CM',
        referringAgentUserId: null,
      })
    ).toHaveLength(3);
  });
});

describe('staffMatchesOrderCountry', () => {
  it('treats null staff country as global', () => {
    expect(staffMatchesOrderCountry(null, 'CM')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(staffMatchesOrderCountry('cm', 'CM')).toBe(true);
  });

  it('rejects a different country', () => {
    expect(staffMatchesOrderCountry('GA', 'CM')).toBe(false);
  });
});
