import {
  hashMetaEmail,
  hashMetaExternalId,
  hashMetaName,
  hashMetaPhone,
  normalizeMetaEmail,
  normalizeMetaPhone,
} from './meta-conversions-hash.util';

describe('meta-conversions-hash.util', () => {
  it('normalizes email lowercase and trims', () => {
    expect(normalizeMetaEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('hashes email consistently', () => {
    const a = hashMetaEmail('test@example.com');
    const b = hashMetaEmail('  TEST@example.com  ');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('strips non-digits from phone before hashing', () => {
    expect(normalizeMetaPhone('+1 (555) 123-4567')).toBe('15551234567');
    expect(hashMetaPhone('+1 (555) 123-4567')).toBe(
      hashMetaPhone('15551234567')
    );
  });

  it('returns empty hash for empty phone digits', () => {
    expect(hashMetaPhone('---')).toBe('');
  });

  it('hashes names lowercase', () => {
    expect(hashMetaName('John')).toBe(hashMetaName('  JOHN '));
  });

  it('hashes external id', () => {
    expect(hashMetaExternalId('user-1')).toHaveLength(64);
  });
});
