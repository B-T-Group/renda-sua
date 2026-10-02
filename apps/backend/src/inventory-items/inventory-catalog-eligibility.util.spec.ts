import {
  isLocationPaymentsEnabled,
  isPayAfterConfirmBadgeVisible,
} from './inventory-catalog-eligibility.util';

describe('inventory-catalog-eligibility.util', () => {
  it('allows verified MoMo location phones', () => {
    expect(
      isLocationPaymentsEnabled(
        {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: true },
        },
        []
      )
    ).toBe(true);
  });

  it('allows stripe-country locations without verified phone', () => {
    expect(
      isLocationPaymentsEnabled(
        { address: { country: 'CA' }, mobile_payment_phone: null },
        ['CA']
      )
    ).toBe(true);
  });

  it('blocks MoMo locations without verified phone', () => {
    expect(
      isLocationPaymentsEnabled(
        { address: { country: 'CM' }, mobile_payment_phone: { is_verified: false } },
        ['CA']
      )
    ).toBe(false);
  });
});

describe('isPayAfterConfirmBadgeVisible', () => {
  const flagged = { pay_at_confirm: true, address: { country: 'CM' } };

  it('shows for a flagged MoMo location when the kill switch is on', () => {
    expect(isPayAfterConfirmBadgeVisible(flagged, ['US'], true)).toBe(true);
  });

  it('hides when the kill switch is off', () => {
    expect(isPayAfterConfirmBadgeVisible(flagged, ['US'], false)).toBe(false);
  });

  it('hides when the location is not flagged', () => {
    expect(
      isPayAfterConfirmBadgeVisible({ ...flagged, pay_at_confirm: false }, [], true)
    ).toBe(false);
    expect(isPayAfterConfirmBadgeVisible(null, [], true)).toBe(false);
  });

  it('hides for Stripe-rail countries', () => {
    expect(
      isPayAfterConfirmBadgeVisible(
        { pay_at_confirm: true, address: { country: 'ca' } },
        ['CA'],
        true
      )
    ).toBe(false);
  });
});
