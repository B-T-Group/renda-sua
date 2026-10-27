import {
  isMmPhoneUnconfirmedError,
  MOBILE_MONEY_PHONE_UNCONFIRMED,
  orderNeedsMmPhoneBeforeConfirm,
} from './orderMmPhoneGate';

describe('orderNeedsMmPhoneBeforeConfirm', () => {
  it('never requires phone on Stripe rail', () => {
    expect(
      orderNeedsMmPhoneBeforeConfirm(
        { business_location: { mobile_payment_phone: null } },
        true
      )
    ).toBe(false);
  });

  it('requires phone on MoMo when unverified or missing', () => {
    expect(
      orderNeedsMmPhoneBeforeConfirm(
        { business_location: { mobile_payment_phone: { is_verified: false } } },
        false
      )
    ).toBe(true);
    expect(
      orderNeedsMmPhoneBeforeConfirm(
        { business_location: { mobile_payment_phone: null } },
        false
      )
    ).toBe(true);
    expect(orderNeedsMmPhoneBeforeConfirm({}, false)).toBe(true);
    expect(
      orderNeedsMmPhoneBeforeConfirm(
        { business_location: { mobile_payment_phone: {} } },
        false
      )
    ).toBe(true);
  });

  it('does not require phone when verified', () => {
    expect(
      orderNeedsMmPhoneBeforeConfirm(
        { business_location: { mobile_payment_phone: { is_verified: true } } },
        false
      )
    ).toBe(false);
  });
});

describe('isMmPhoneUnconfirmedError', () => {
  it('detects code and message', () => {
    expect(
      isMmPhoneUnconfirmedError({ code: MOBILE_MONEY_PHONE_UNCONFIRMED })
    ).toBe(true);
    expect(
      isMmPhoneUnconfirmedError({
        message: `Failed: ${MOBILE_MONEY_PHONE_UNCONFIRMED}`,
      })
    ).toBe(true);
    expect(isMmPhoneUnconfirmedError({ message: 'other' })).toBe(false);
    expect(isMmPhoneUnconfirmedError(null)).toBe(false);
    expect(
      isMmPhoneUnconfirmedError('MOBILE_MONEY_PHONE_UNCONFIRMED')
    ).toBe(false);
  });
});
