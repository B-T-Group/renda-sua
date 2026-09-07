import { describe, expect, it, vi } from 'vitest';

vi.mock('./deviceDefaultCountry', () => ({
  getDeviceDefaultCountryCode: () => 'CM',
}));

import {
  pickMobileMoneyDefaultCountry,
  validateOrderPaymentPhone,
  validateOrderPaymentPhoneForCountry,
} from './placeOrderPhoneValidation';

describe('validateOrderPaymentPhone', () => {
  it('accepts Cameroon E.164', () => {
    const result = validateOrderPaymentPhone('+237692168717');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164).toBe('+237692168717');
  });

  it('rejects a national Cameroon number without a country', () => {
    expect(validateOrderPaymentPhone('692168717').ok).toBe(false);
  });

  it('accepts a national Cameroon number when the country is CM', () => {
    const result = validateOrderPaymentPhone('692168717', ['CM', 'GA'], 'CM');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164).toBe('+237692168717');
  });
});

describe('validateOrderPaymentPhoneForCountry', () => {
  it('builds E.164 from the selected country', () => {
    const result = validateOrderPaymentPhoneForCountry('CM', '692168717');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164).toBe('+237692168717');
  });
});

describe('pickMobileMoneyDefaultCountry', () => {
  it('uses the item location when it is CM or GA', () => {
    expect(pickMobileMoneyDefaultCountry('cm')).toBe('CM');
    expect(pickMobileMoneyDefaultCountry('GA')).toBe('GA');
  });

  it('falls back to CM when the item country is not a MoMo market', () => {
    expect(pickMobileMoneyDefaultCountry('CA')).toBe('CM');
  });
});
