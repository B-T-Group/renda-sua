import { isLocationPaymentsEnabled } from './inventory-catalog-eligibility.util';

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
