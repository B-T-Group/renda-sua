import { describe, expect, it } from 'vitest';
import { basicsLocationPatch, createLocationPayload } from './locationWritePayload';

const addressForm = {
  address_line_1: 'Rue Joss',
  city: 'Douala',
  state: 'LT',
};

describe('location write payloads', () => {
  it('does not turn off Stripe auto-payout when creating a location', () => {
    const payload = createLocationPayload({
      name: 'Akwa',
      isStripeRail: true,
      phone: '+14165550100',
      mobilePaymentPhoneId: null,
      addressForm,
    });
    expect(payload.auto_withdraw_commissions).toBeUndefined();
    expect(payload.phone).toBe('+14165550100');
  });

  it('opts a Mobile Money location into automatic payout', () => {
    const payload = createLocationPayload({
      name: 'Akwa',
      isStripeRail: false,
      phone: '',
      mobilePaymentPhoneId: 'phone-1',
      addressForm,
    });
    expect(payload.auto_withdraw_commissions).toBe(true);
    expect(payload.mobile_payment_phone_id).toBe('phone-1');
  });

  it('does not clear Stripe auto-payout when saving the location name', () => {
    const payload = basicsLocationPatch({
      name: 'Akwa',
      email: '',
      logoUrl: '',
      isStripeRail: true,
      phone: '+14165550100',
    });
    expect(payload).toEqual({
      name: 'Akwa',
      email: undefined,
      logo_url: null,
      phone: '+14165550100',
    });
    expect(payload.auto_withdraw_commissions).toBeUndefined();
  });
});
