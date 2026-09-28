import { describe, expect, it } from 'vitest';
import { freshCodeSignInParams } from './freshCodeSignIn';

describe('freshCodeSignInParams', () => {
  it('starts an email code and ignores the saved phone', () => {
    expect(
      freshCodeSignInParams(
        { email: '  ada@example.com  ', phone: '+237622222222' },
        42
      )
    ).toEqual({
      prefillEmail: 'ada@example.com',
      prefillPhoneE164: undefined,
      autoStartOtp: true,
      autoStartNonce: 42,
    });
  });

  it('starts an SMS code for a phone-only profile', () => {
    expect(
      freshCodeSignInParams({ email: '  ', phone: ' +237622222222 ' }, 7)
    ).toEqual({
      prefillEmail: undefined,
      prefillPhoneE164: '+237622222222',
      autoStartOtp: true,
      autoStartNonce: 7,
    });
  });

  it('opens login without sending a code when the profile has no contact', () => {
    expect(freshCodeSignInParams({ email: null, phone: ' ' }, 1)).toEqual({
      prefillEmail: undefined,
      prefillPhoneE164: undefined,
      autoStartOtp: false,
      autoStartNonce: 1,
    });
  });
});
