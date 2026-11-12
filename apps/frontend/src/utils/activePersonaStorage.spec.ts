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

  it('omits active_persona in delegation mode', () => {
    writeStoredActiveDelegation('user-1', 'delegation-1');
    expect(activePersonaAuthField()).toEqual({});
    expect(authorizationParamsWithActivePersona({ audience: 'api' })).toEqual({
      audience: 'api',
    });
  });
});
