import { randomUUID } from 'crypto';
import type { RequestContext } from './request-context';
import { emptyRequestContext } from './request-context';

const HASURA_JWT_CLAIMS_NAMESPACE = 'https://hasura.io/jwt/claims';

function headerValue(
  headers: Record<string, unknown> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const raw = headers[lower] ?? headers[name];
  return typeof raw === 'string' ? raw : undefined;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT format');
  }
  const json = Buffer.from(parts[1], 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

export function extractBearerToken(
  headers: Record<string, unknown> | undefined
): string | null {
  const authHeader = headerValue(headers, 'authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export function extractHasuraUserIdFromToken(token: string): string {
  const payload = decodeJwtPayload(token);
  const claims = payload[HASURA_JWT_CLAIMS_NAMESPACE] as
    | Record<string, unknown>
    | undefined;
  const id = claims?.['x-hasura-user-id'] ?? claims?.['X-Hasura-User-Id'];
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Missing x-hasura-user-id in Hasura JWT claims');
  }
  return String(id);
}

export function extractActivePersonaHeader(
  headers: Record<string, unknown> | undefined
): string | undefined {
  return headerValue(headers, 'x-active-persona');
}

/** Build RequestContext from an HTTP-like request (headers bag). */
export function buildRequestContextFromHeaders(
  headers: Record<string, unknown> | undefined,
  requestId?: string
): RequestContext {
  const authToken = extractBearerToken(headers);
  let userId = 'anonymous';
  if (authToken) {
    try {
      userId = extractHasuraUserIdFromToken(authToken);
    } catch {
      userId = 'anonymous';
    }
  }
  return emptyRequestContext({
    userId,
    authToken,
    activePersona: extractActivePersonaHeader(headers),
    requestId: requestId || headerValue(headers, 'x-request-id') || randomUUID(),
  });
}
