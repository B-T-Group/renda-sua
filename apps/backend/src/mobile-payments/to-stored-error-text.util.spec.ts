import { toStoredErrorText } from './to-stored-error-text.util';

describe('toStoredErrorText', () => {
  it('returns trimmed strings and falls back for blank ones', () => {
    expect(toStoredErrorText(' payer invalid ')).toBe('payer invalid');
    expect(toStoredErrorText('   ', 'fallback')).toBe('fallback');
  });

  it('joins Nest-style validation arrays into a single text field', () => {
    expect(
      toStoredErrorText(['payer must be a phone number', 'amount must be positive'])
    ).toBe('payer must be a phone number; amount must be positive');
  });

  it('stringifies numbers, objects, and empty arrays with a fallback', () => {
    expect(toStoredErrorText(400, 'UNKNOWN', 50)).toBe('400');
    expect(toStoredErrorText({ code: 'BAD_REQUEST' })).toBe('{"code":"BAD_REQUEST"}');
    expect(toStoredErrorText([], 'Failed to initiate payment')).toBe(
      'Failed to initiate payment'
    );
  });
});
