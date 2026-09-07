import { describe, expect, it } from 'vitest';
import {
  businessReferralPayoutSchedule,
  payoutCountryCode,
} from './businessReferralPayoutSchedule';

describe('businessReferralPayoutSchedule', () => {
  it('uses CAD amounts for Canada', () => {
    expect(businessReferralPayoutSchedule('CA')).toEqual({
      currency: 'CAD',
      catalog10Amount: 25,
      catalog10MinSaleTotal: 0,
      salePercent: 1,
    });
  });

  it('uses XAF amounts for Cameroon, Gabon, and unknown markets', () => {
    expect(businessReferralPayoutSchedule('CM').currency).toBe('XAF');
    expect(businessReferralPayoutSchedule('GA').catalog10Amount).toBe(7500);
    expect(businessReferralPayoutSchedule('CM').catalog10MinSaleTotal).toBe(2500);
    expect(businessReferralPayoutSchedule('xx').salePercent).toBe(1);
  });

  it('prefers the account country over the catalog market', () => {
    expect(payoutCountryCode('CA', 'CM')).toBe('CA');
    expect(payoutCountryCode(null, 'GA')).toBe('GA');
  });
});
