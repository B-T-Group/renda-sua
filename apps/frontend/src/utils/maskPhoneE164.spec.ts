import { maskPhoneE164 } from './maskPhoneE164';

describe('maskPhoneE164', () => {
  it('masks keeping last 4 digits', () => {
    expect(maskPhoneE164('+237670000123')).toBe('••••••0123');
  });

  it('handles empty and short values', () => {
    expect(maskPhoneE164('')).toBe('••••');
    expect(maskPhoneE164('12')).toBe('••••');
  });

  it('strips non-digits before masking', () => {
    expect(maskPhoneE164('+241 06 00 00 99')).toBe('••••••0099');
  });
});
