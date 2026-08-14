import { businessReferralPayoutConfigKey } from './business-referral-payout-config.util';

describe('businessReferralPayoutConfigKey', () => {
  it('uses the internal amount key for employees', () => {
    expect(businessReferralPayoutConfigKey(true)).toBe(
      'business_referral_payout_amount_internal'
    );
  });

  it('uses the standard amount key for external agents', () => {
    expect(businessReferralPayoutConfigKey(false)).toBe(
      'business_referral_payout_amount'
    );
  });
});
