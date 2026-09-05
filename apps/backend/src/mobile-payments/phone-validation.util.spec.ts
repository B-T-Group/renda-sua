import {
  detectCameroonPhone,
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
});

describe('detectCameroonPhone', () => {
  it('classifies Orange 692 prefixes as Cameroon', () => {
    expect(detectCameroonPhone('692168717')?.carrier).toBe('orange');
    expect(detectCameroonPhone('+237692168717')?.carrier).toBe('orange');
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
