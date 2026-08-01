import { HttpException, HttpStatus } from '@nestjs/common';
import { emptyRequestContext } from '../auth/request-context';
import {
  getActivePersonaOrThrow,
  isActivePersona,
  resolveSessionPersona,
} from './persona.util';

describe('persona.util (JWT session persona)', () => {
  const multiUser = {
    client: { id: 'c1' },
    agent: { id: 'a1' },
    user_type_id: 'client',
  };

  const agentCtx = emptyRequestContext({
    jwtDefaultRole: 'agent',
    jwtAllowedRoles: ['agent', 'client'],
  });

  it('resolves valid JWT role with matching profile', () => {
    expect(resolveSessionPersona(multiUser, agentCtx)).toBe('agent');
  });

  it('rejects JWT role not in allowed roles', () => {
    expect(() =>
      resolveSessionPersona(multiUser, {
        jwtDefaultRole: 'business',
        jwtAllowedRoles: ['client'],
      })
    ).toThrow(HttpException);
  });

  it('rejects JWT role without profile row', () => {
    expect(() =>
      resolveSessionPersona(multiUser, {
        jwtDefaultRole: 'business',
        jwtAllowedRoles: ['business', 'client'],
      })
    ).toThrow(HttpException);
  });

  it('rejects missing JWT default role', () => {
    expect(() => resolveSessionPersona(multiUser, {})).toThrow(HttpException);
  });

  it('JWT agent wins over DB user_type_id client', () => {
    expect(resolveSessionPersona(multiUser, agentCtx)).toBe('agent');
    const user = { ...multiUser, active_persona: 'agent' as const };
    expect(isActivePersona(user, 'agent')).toBe(true);
    expect(isActivePersona(user, 'client')).toBe(false);
  });

  it('prefers validated X-Active-Persona over stale JWT default role', () => {
    expect(
      resolveSessionPersona(multiUser, {
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent', 'client'],
        activePersona: 'client',
      })
    ).toBe('client');
  });

  it('ignores X-Active-Persona when not in JWT allowed roles', () => {
    expect(
      resolveSessionPersona(multiUser, {
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
        activePersona: 'client',
      })
    ).toBe('agent');
  });

  it('ignores X-Active-Persona without matching profile row', () => {
    expect(
      resolveSessionPersona(multiUser, {
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent', 'client', 'business'],
        activePersona: 'business',
      })
    ).toBe('agent');
  });

  it('getActivePersonaOrThrow uses active_persona on user', () => {
    expect(
      getActivePersonaOrThrow({ ...multiUser, active_persona: 'client' })
    ).toBe('client');
  });

  it('throws when active_persona missing on user', () => {
    expect(() => getActivePersonaOrThrow(multiUser)).toThrow(HttpException);
    try {
      getActivePersonaOrThrow(multiUser);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});
