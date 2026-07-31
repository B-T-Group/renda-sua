import {
  normalizeToE164,
  toMobileMoneyCallingCode,
  isoFromMobileMoneyCallingCode,
} from './phone-e164.util';

describe('phone-e164.util', () => {
  it('maps ISO alpha-2 to calling codes', () => {
    expect(toMobileMoneyCallingCode('CM')).toBe('237');
    expect(toMobileMoneyCallingCode('ga')).toBe('241');
    expect(toMobileMoneyCallingCode('237')).toBe('237');
    expect(toMobileMoneyCallingCode('US')).toBeNull();
  });

  it('maps calling codes back to ISO', () => {
    expect(isoFromMobileMoneyCallingCode('237')).toBe('CM');
    expect(isoFromMobileMoneyCallingCode('241')).toBe('GA');
  });

  it('normalizes using ISO country codes', () => {
    expect(normalizeToE164('CM', '600000001')).toBe('+237600000001');
    expect(normalizeToE164('GA', '600000001')).toBe('+241600000001');
  });
});
