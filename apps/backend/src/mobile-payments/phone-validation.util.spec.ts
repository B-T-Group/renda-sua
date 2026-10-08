import {
  detectCameroonPhone,
  isCameroonCountryCode,
  resolveWalletPhoneRegion,
  validatePhoneNumber,
} from './phone-validation.util';

describe('validatePhoneNumber', () => {
  it('accepts Cameroon E.164 without a default region', () => {
    const result = validatePhoneNumber('+237692168717', 'GA');
    expect(result.isValid).toBe(true);
    expect(result.regionCode).toBe('CM');
    expect(result.nationalNumber).toBe('692168717');
  });

  it('accepts a Cameroon national number when the region is CM', () => {
    const result = validatePhoneNumber('692168717', 'CM');
    expect(result.isValid).toBe(true);
    expect(result.regionCode).toBe('CM');
  });

  it('rejects a Cameroon national number when parsed as Gabon', () => {
    const result = validatePhoneNumber('692168717', 'GA');
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid phone numbers', () => {
    const invalidNigeria = validatePhoneNumber('+23488888888888');
    expect(invalidNigeria.isValid).toBe(false);

    const invalidCameroon = validatePhoneNumber('+237123');
    expect(invalidCameroon.isValid).toBe(false);
  });

  it('accepts valid phone numbers', () => {
    const validCameroon = validatePhoneNumber('+237691234567');
    expect(validCameroon.isValid).toBe(true);

    const validGabon = validatePhoneNumber('+24162123456');
    expect(validGabon.isValid).toBe(true);

    const validCanada = validatePhoneNumber('+14165551234');
    expect(validCanada.isValid).toBe(true);
  });
});

describe('detectCameroonPhone', () => {
  it('classifies Orange 692 prefixes as Cameroon', () => {
    expect(detectCameroonPhone('692168717')?.carrier).toBe('orange');
    expect(detectCameroonPhone('+237692168717')?.carrier).toBe('orange');
  });

  it('treats every +237 number as Cameroon, including new prefixes', () => {
    expect(isCameroonCountryCode('+237640448217')).toBe(true);
    expect(isCameroonCountryCode('00237640448217')).toBe(true);
    expect(isCameroonCountryCode('+237 640 44 82 17')).toBe(true);
    expect(detectCameroonPhone('+237640448217')?.carrier).toBe('other');
    expect(detectCameroonPhone('+237 640 44 82 17')?.carrier).toBe('other');
    expect(detectCameroonPhone('640448217')).toBeNull();
  });

  it('does not treat a blank, Gabon, or embedded 237 number as Cameroon', () => {
    expect(isCameroonCountryCode(null)).toBe(false);
    expect(isCameroonCountryCode('')).toBe(false);
    expect(isCameroonCountryCode('   ')).toBe(false);
    expect(isCameroonCountryCode('+24106123456')).toBe(false);
    expect(isCameroonCountryCode('+241237000000')).toBe(false);
    expect(isCameroonCountryCode('640448217')).toBe(false);
  });
});

describe('resolveWalletPhoneRegion', () => {
  it('prefers users.country over address and phone digits', () => {
    expect(
      resolveWalletPhoneRegion({
        phone: '692168717',
        userCountry: 'GA',
        addressCountry: 'CM',
      })
    ).toBe('GA');
  });

  it('uses Cameroon detection when no user country is available', () => {
    expect(resolveWalletPhoneRegion({ phone: '692168717' })).toBe('CM');
  });

  it('falls back to GA when nothing else resolves', () => {
    expect(resolveWalletPhoneRegion({})).toBe('GA');
  });
});
