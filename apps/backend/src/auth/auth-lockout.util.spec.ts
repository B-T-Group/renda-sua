import { buildIdentifierLockoutKey } from './auth-lockout.util';

describe('buildIdentifierLockoutKey', () => {
  it('prefixes the normalized OTP identifier', () => {
    expect(
      buildIdentifierLockoutKey({ email: ' Shop@Example.COM ' })
    ).toBe('identifier:email:shop@example.com');
    expect(buildIdentifierLockoutKey({ phone: '+237670000000' })).toBe(
      'identifier:phone:+237670000000'
    );
  });
});
