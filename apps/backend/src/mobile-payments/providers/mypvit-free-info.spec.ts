import { sanitizeFreeInfo } from './mypvit.service';

describe('sanitizeFreeInfo', () => {
  it('strips the "+" from E.164 phone numbers', () => {
    expect(sanitizeFreeInfo('Verify +241674123456')).toBe('Verify 24167412');
  });

  it('caps the result at 15 characters', () => {
    expect(sanitizeFreeInfo('Phone verification refund')).toHaveLength(15);
  });

  it('collapses runs of whitespace created by stripping punctuation', () => {
    expect(sanitizeFreeInfo('order #12 / paid')).toBe('order 12 paid');
  });

  it('keeps letters, digits, dashes and spaces', () => {
    expect(sanitizeFreeInfo('RB-1234 ok')).toBe('RB-1234 ok');
  });

  it('returns undefined when nothing usable remains', () => {
    expect(sanitizeFreeInfo('+++')).toBeUndefined();
    expect(sanitizeFreeInfo('')).toBeUndefined();
    expect(sanitizeFreeInfo(undefined)).toBeUndefined();
  });

  it('does not leave a trailing space after truncation', () => {
    expect(sanitizeFreeInfo('abcdefghijklmn opq')).toBe('abcdefghijklmn');
  });
});
