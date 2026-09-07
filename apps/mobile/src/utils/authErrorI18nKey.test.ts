import { describe, expect, it } from 'vitest';
import { getAuthFlowErrorKey } from './authErrorI18nKey';

describe('getAuthFlowErrorKey', () => {
  it('maps invalid_grant to invalidOtp', () => {
    expect(getAuthFlowErrorKey('invalid_grant')).toBe('auth.errors.invalidOtp');
  });

  it('maps browser / opaque fetch failures (CORS)', () => {
    expect(getAuthFlowErrorKey('Failed to fetch')).toBe('auth.errors.browserOrCors');
    expect(getAuthFlowErrorKey('Network request failed')).toBe('auth.errors.browserOrCors');
  });

  it('maps real network-style messages', () => {
    expect(getAuthFlowErrorKey('getaddrinfo ENOTFOUND')).toBe('auth.errors.network');
    expect(getAuthFlowErrorKey('Connection refused')).toBe('auth.errors.network');
  });

  it('does not treat generic French auth message as network', () => {
    expect(getAuthFlowErrorKey('Erreur de connexion')).toBe('auth.errors.generic');
  });

  it('maps generic invalid credentials', () => {
    expect(getAuthFlowErrorKey('Wrong email or password.')).toBe('auth.errors.invalidCredentials');
  });

  it('maps expired signup attempt messages', () => {
    expect(
      getAuthFlowErrorKey('Signup attempt expired. Please start again.')
    ).toBe('auth.signupFlow.attemptExpired');
  });

  it('maps max invalid signup codes before generic OTP mapping', () => {
    expect(
      getAuthFlowErrorKey('Too many invalid codes. Please start signup again.')
    ).toBe('auth.signupFlow.attemptExpired');
  });
});
