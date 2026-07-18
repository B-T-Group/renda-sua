export const REQUEST_CONTEXT_CLS_KEY = 'requestContext';

export interface RequestContext {
  userId: string;
  authToken: string | null;
  activePersona?: string;
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
