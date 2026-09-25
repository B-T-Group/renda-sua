import {
  buildAuthGateIdentifierKey,
  readActiveAuthGateLockout,
  writeAuthGateLockout,
} from './authGateLockoutStorage';

describe('authGateLockoutStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persists lockout for reopen', () => {
    const key = buildAuthGateIdentifierKey({ email: 'user@example.com' });
    writeAuthGateLockout(key, Date.now() + 60_000);
    const active = readActiveAuthGateLockout();
    expect(active?.identifierKey).toBe(key);
  });
});
