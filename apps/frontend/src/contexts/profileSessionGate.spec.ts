import { profileSessionGate } from './profileSessionGate';

describe('profileSessionGate', () => {
  it('waits while Auth0 is still loading', () => {
    expect(profileSessionGate(true, false, false)).toBe('wait');
    expect(profileSessionGate(true, true, false)).toBe('wait');
  });

  it('waits while the session cookie is still hydrating', () => {
    expect(profileSessionGate(false, false, false)).toBe('wait');
  });

  it('fetches the profile once a hydrated session is authenticated', () => {
    expect(profileSessionGate(false, true, true)).toBe('fetch');
  });

  it('clears profile state only after hydrate proves the user is logged out', () => {
    expect(profileSessionGate(false, true, false)).toBe('clear');
  });
});
