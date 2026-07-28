import { emptyRequestContext, type RequestContext } from '../request-context';
import type { PersonaId } from '../../users/persona.types';

export function mockRequestContext(
  overrides: Partial<RequestContext> = {}
): RequestContext {
  return emptyRequestContext(overrides);
}

export function mockPersonaJwtContext(
  defaultRole: PersonaId,
  allowedRoles?: PersonaId[]
): Pick<RequestContext, 'jwtDefaultRole' | 'jwtAllowedRoles'> {
  return {
    jwtDefaultRole: defaultRole,
    jwtAllowedRoles: allowedRoles ?? [defaultRole],
  };
}

export function mockUserWithPersona<T extends Record<string, unknown>>(
  user: T,
  activePersona: PersonaId
): T & { active_persona: PersonaId } {
  return { ...user, active_persona: activePersona };
}
