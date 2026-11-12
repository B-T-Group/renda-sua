import {
  activePersonaAuthField,
  authorizationParamsWithActivePersona,
  clearStoredActivePersona,
  writeStoredActiveDelegation,
  writeStoredActivePersona,
} from './activePersonaStorage';

describe('active persona auth params', () => {
  afterEach(() => {
    clearStoredActivePersona();
  });

  it('includes the stored persona on authorize params and the token field', () => {
    writeStoredActivePersona('user-1', 'business');
    expect(activePersonaAuthField()).toEqual({ active_persona: 'business' });
    expect(
      authorizationParamsWithActivePersona({
        connection: 'email',
        login_hint: 'oru@rendasua-test.com',
      })
    ).toEqual({
      connection: 'email',
      login_hint: 'oru@rendasua-test.com',
      active_persona: 'business',
    });
  });

  it('omits active_persona in delegation mode for OTP bodies', () => {
    writeStoredActiveDelegation('user-1', 'delegation-1');
    expect(activePersonaAuthField()).toEqual({});
  });

  it('clears a provider-baked persona when delegation refresh merges params', () => {
    writeStoredActiveDelegation('user-1', 'delegation-1');
    const providerDefaults = {
      audience: 'api',
      scope: 'openid profile email',
      active_persona: 'business',
    };
    const merged = {
      ...providerDefaults,
      ...authorizationParamsWithActivePersona({ audience: 'api' }),
      grant_type: 'refresh_token',
    };
    const body = JSON.parse(JSON.stringify(merged)) as Record<string, unknown>;
    expect(body.audience).toBe('api');
    expect(body.grant_type).toBe('refresh_token');
    expect(body.active_persona).toBeUndefined();
  });

  it('replaces a provider-baked persona with the stored one', () => {
    writeStoredActivePersona('user-1', 'client');
    const merged = {
      audience: 'api',
      active_persona: 'business',
      ...authorizationParamsWithActivePersona(),
    };
    const body = JSON.parse(JSON.stringify(merged)) as Record<string, unknown>;
    expect(body.active_persona).toBe('client');
  });
});
