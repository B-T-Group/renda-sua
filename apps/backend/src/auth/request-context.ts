import type { PersonaId } from '../users/persona.types';

export const REQUEST_CONTEXT_CLS_KEY = 'requestContext';

export interface RequestContext {
  userId: string;
  authToken: string | null;
  /** @deprecated Ignored for auth; session persona comes from JWT claims. */
  activePersona?: string;
  jwtDefaultRole?: PersonaId;
  jwtAllowedRoles?: PersonaId[];
  requestId?: string;
}

export function emptyRequestContext(
  overrides: Partial<RequestContext> = {}
): RequestContext {
  return {
    userId: 'anonymous',
    authToken: null,
    ...overrides,
  };
}

/** JWT Hasura claims used to resolve the session persona. */
export type SessionPersonaContext = Pick<
  RequestContext,
  'jwtDefaultRole' | 'jwtAllowedRoles'
>;
