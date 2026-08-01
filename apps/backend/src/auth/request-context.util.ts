import { randomUUID } from 'crypto';
import type { RequestContext } from './request-context';
import { emptyRequestContext } from './request-context';
import { isPersonaId, type PersonaId } from '../users/persona.types';

const HASURA_JWT_CLAIMS_NAMESPACE = 'https://hasura.io/jwt/claims';

export interface HasuraJwtClaims {
  userId: string;
  defaultRole?: PersonaId;
  allowedRoles: PersonaId[];
}

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

function readHasuraClaimsBlock(
  payload: Record<string, unknown>
): Record<string, unknown> | undefined {
  return payload[HASURA_JWT_CLAIMS_NAMESPACE] as
    | Record<string, unknown>
    | undefined;
}

function normalizePersonaRole(raw: unknown): PersonaId | undefined {
  if (raw === undefined || raw === null) return undefined;
  const v = String(raw).trim().toLowerCase();
  return isPersonaId(v) ? v : undefined;
}

function parseAllowedRoles(raw: unknown): PersonaId[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => normalizePersonaRole(entry))
      .filter((entry): entry is PersonaId => !!entry);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        return parseAllowedRoles(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
    const role = normalizePersonaRole(trimmed);
    return role ? [role] : [];
  }
  return [];
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

export function extractHasuraClaimsFromToken(token: string): HasuraJwtClaims {
  const payload = decodeJwtPayload(token);
  const claims = readHasuraClaimsBlock(payload);
  const id = claims?.['x-hasura-user-id'] ?? claims?.['X-Hasura-User-Id'];
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Missing x-hasura-user-id in Hasura JWT claims');
  }
  const defaultRole = normalizePersonaRole(
    claims?.['x-hasura-default-role'] ?? claims?.['X-Hasura-Default-Role']
  );
  const allowedRoles = parseAllowedRoles(
    claims?.['x-hasura-allowed-roles'] ?? claims?.['X-Hasura-Allowed-Roles']
  );
  return {
    userId: String(id),
    defaultRole,
    allowedRoles,
  };
}

export function extractHasuraUserIdFromToken(token: string): string {
  return extractHasuraClaimsFromToken(token).userId;
}

/** Optional client-selected persona from `X-Active-Persona`. */
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
  let jwtDefaultRole: PersonaId | undefined;
  let jwtAllowedRoles: PersonaId[] | undefined;
  if (authToken) {
    try {
      const claims = extractHasuraClaimsFromToken(authToken);
      userId = claims.userId;
      jwtDefaultRole = claims.defaultRole;
      jwtAllowedRoles = claims.allowedRoles;
    } catch {
      userId = 'anonymous';
    }
  }
  return emptyRequestContext({
    userId,
    authToken,
    activePersona: extractActivePersonaHeader(headers),
    jwtDefaultRole,
    jwtAllowedRoles,
    requestId: requestId || headerValue(headers, 'x-request-id') || randomUUID(),
  });
}
