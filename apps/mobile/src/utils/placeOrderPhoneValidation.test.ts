import { describe, expect, it, vi } from 'vitest';

vi.mock('./deviceDefaultCountry', () => ({
  getDeviceDefaultCountryCode: () => 'CM',
}));

import {
  isMobileMoneyCountry,
  mobileMoneyCallingCode,
  mobileMoneyIsoFromCallingCode,
  pickMobileMoneyDefaultCountry,
  resolveMobileMoneyCountries,
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
  it('uses the item location when it is a MoMo market', () => {
    expect(pickMobileMoneyDefaultCountry('cm')).toBe('CM');
    expect(pickMobileMoneyDefaultCountry('GA')).toBe('GA');
  });

  it('falls back to CM when the item country is not a MoMo market', () => {
    expect(pickMobileMoneyDefaultCountry('CA')).toBe('CM');
  });
});

describe('Togo (+228) Mobile Money', () => {
  it('accepts Togocel and Moov Togo numbers by default', () => {
    for (const n of ['+22890112233', '+22899112233']) {
      const r = validateOrderPaymentPhone(n);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.e164).toBe(n);
    }
  });

  it('builds TG E.164 from the picker country', () => {
    const r = validateOrderPaymentPhoneForCountry('TG', '90112233');
    expect(r).toEqual({ ok: true, e164: '+22890112233' });
  });

  it('rejects TG when the backend list does not include it', () => {
    expect(validateOrderPaymentPhoneForCountry('TG', '90112233', ['CM', 'GA'])).toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });

  it('keeps TG as the default for a Togo item', () => {
    expect(pickMobileMoneyDefaultCountry('tg')).toBe('TG');
  });

  it('falls back to the first allowed country when neither item nor device fit', () => {
    expect(pickMobileMoneyDefaultCountry('CA', ['TG'])).toBe('TG');
  });
});

describe('resolveMobileMoneyCountries', () => {
  it('uses the static CM/GA/TG list while the backend list is empty', () => {
    expect(resolveMobileMoneyCountries([])).toEqual(['CM', 'GA', 'TG']);
    expect(resolveMobileMoneyCountries(undefined)).toEqual(['CM', 'GA', 'TG']);
  });

  it('keeps MoMo-routable countries the backend reports (DEV shape: TG active, no rows yet)', () => {
    expect(
      resolveMobileMoneyCountries([
        { code: 'CA', serviceStatus: 'active', supportedPaymentMethods: ['stripe'] },
        { code: 'CM', serviceStatus: 'active', supportedPaymentMethods: ['freemopay', 'orange'] },
        { code: 'GA', serviceStatus: 'active', supportedPaymentMethods: ['airtel', 'moov'] },
        { code: 'TG', serviceStatus: 'active', supportedPaymentMethods: [] },
        { code: 'BJ', serviceStatus: 'active', supportedPaymentMethods: [] },
      ])
    ).toEqual(['CM', 'GA', 'TG']);
  });

  it('drops a MoMo country the backend marks inactive with no payment system', () => {
    expect(
      resolveMobileMoneyCountries([
        { code: 'CM', serviceStatus: 'active', supportedPaymentMethods: ['freemopay'] },
        { code: 'TG', serviceStatus: 'coming_soon', supportedPaymentMethods: [] },
      ])
    ).toEqual(['CM']);
  });

  it('keeps an inactive country that has a MoMo payment system configured', () => {
    expect(
      resolveMobileMoneyCountries([
        { code: 'tg', serviceStatus: 'paused', supportedPaymentMethods: ['fedapay'] },
      ])
    ).toEqual(['TG']);
  });
});

describe('calling-code helpers', () => {
  it('maps between ISO and calling codes for MoMo countries', () => {
    expect(mobileMoneyCallingCode('TG')).toBe('228');
    expect(mobileMoneyCallingCode('GA')).toBe('241');
    expect(mobileMoneyIsoFromCallingCode('228')).toBe('TG');
    expect(mobileMoneyIsoFromCallingCode('+237')).toBe('CM');
    expect(mobileMoneyIsoFromCallingCode('33')).toBeNull();
  });

  it('isMobileMoneyCountry respects the allowed list', () => {
    expect(isMobileMoneyCountry('tg')).toBe(true);
    expect(isMobileMoneyCountry('TG', ['CM', 'GA'])).toBe(false);
    expect(isMobileMoneyCountry(null)).toBe(false);
  });
});
