import type { PersonaId } from '../users/persona.types';

export const REQUEST_CONTEXT_CLS_KEY = 'requestContext';

export interface RequestContext {
  userId: string;
  authToken: string | null;
  /**
   * Client-selected persona (`X-Active-Persona`). Used when present and valid
   * against JWT allowed roles + profile rows; otherwise JWT default role wins.
   */
  activePersona?: string;
  /** Client-selected location grant (`X-Active-Delegation`). */
  activeDelegation?: string;
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

/** JWT claims + optional client header used to resolve the session persona. */
export type SessionPersonaContext = Pick<
  RequestContext,
  'jwtDefaultRole' | 'jwtAllowedRoles' | 'activePersona'
>;
