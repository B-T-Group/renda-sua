import {
  businessReferralPayoutConfigKey,
  businessReferralPayoutConfigKeyFromUser,
  businessReferralPayoutTier,
} from './business-referral-payout-config.util';

describe('businessReferralPayoutTier', () => {
  it('uses internal for employees even without an agent persona', () => {
    expect(
      businessReferralPayoutTier({ isInternal: true, hasAgentPersona: false })
    ).toBe('internal');
  });

  it('uses standard for non-internal users with an agent persona', () => {
    expect(
      businessReferralPayoutTier({ isInternal: false, hasAgentPersona: true })
    ).toBe('standard');
  });

  it('uses b2b when the referrer has no agent persona', () => {
    expect(
      businessReferralPayoutTier({ isInternal: false, hasAgentPersona: false })
    ).toBe('b2b');
  });
});

describe('businessReferralPayoutConfigKey', () => {
  it('maps internal tier to the employee amount key', () => {
    expect(businessReferralPayoutConfigKey('internal')).toBe(
      'business_referral_payout_amount_internal'
    );
  });

  it('maps standard tier to the agent amount key', () => {
    expect(businessReferralPayoutConfigKey('standard')).toBe(
      'business_referral_payout_amount'
    );
  });

  it('maps b2b tier to the business-to-business amount key', () => {
    expect(businessReferralPayoutConfigKey('b2b')).toBe(
      'business_to_business_referral_amount'
    );
  });
});

describe('businessReferralPayoutConfigKeyFromUser', () => {
  it('uses the standard key for a non-internal agent', () => {
    expect(
      businessReferralPayoutConfigKeyFromUser({
        internal: false,
        agent: { id: 'agent-1' },
      })
    ).toBe('business_referral_payout_amount');
  });

  it('uses the b2b key when there is no agent profile', () => {
    expect(
      businessReferralPayoutConfigKeyFromUser({ internal: false, agent: null })
    ).toBe('business_to_business_referral_amount');
  });
});
