import { describe, expect, it } from 'vitest';
import { isAfricanMarketCountry } from '../constants/marketCountries';

describe('signup OTP channel selection', () => {
  it('prefers SMS for African markets when a phone is present', () => {
    const phoneE164 = '+237600000001';
    const country = 'CM';
    const useSms = Boolean(phoneE164) && isAfricanMarketCountry(country);
    expect(useSms).toBe(true);
  });

  it('prefers email for Stripe markets even when phone is present', () => {
    const phoneE164 = '+14155550123';
    const country = 'CA';
    const useSms = Boolean(phoneE164) && isAfricanMarketCountry(country);
    expect(useSms).toBe(false);
  });
});
