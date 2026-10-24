import { describe, expect, it, vi } from 'vitest';

vi.mock('./deviceDefaultCountry', () => ({
  getDeviceDefaultCountryCode: () => 'CM',
}));

import { isWithdrawPhoneFormValid, withdrawPhoneFormToE164 } from './withdrawValidation';

describe('withdraw phone form', () => {
  it('builds a Togo number and rejects it when TG is not allowed', () => {
    expect(withdrawPhoneFormToE164('TG', '90112233')).toBe('+22890112233');
    expect(isWithdrawPhoneFormValid('TG', '90112233')).toBe(true);
    expect(withdrawPhoneFormToE164('TG', '90112233', ['CM', 'GA'])).toBeNull();
    expect(isWithdrawPhoneFormValid('TG', '90112233', ['CM', 'GA'])).toBe(false);
  });

  it('rejects empty or non-numeric digits', () => {
    expect(isWithdrawPhoneFormValid('TG', '')).toBe(false);
    expect(withdrawPhoneFormToE164('CM', 'abc')).toBeNull();
    expect(isWithdrawPhoneFormValid('GA', '12')).toBe(false);
  });
});
