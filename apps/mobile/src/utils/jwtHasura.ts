const HASURA_CLAIMS = 'https://hasura.io/jwt/claims';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readHasuraClaims(token: string): Record<string, unknown> | null {
  const claims = decodeJwtPayload(token)?.[HASURA_CLAIMS];
  if (!claims || typeof claims !== 'object') return null;
  return claims as Record<string, unknown>;
}

function parseAllowedRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith('[')) return [trimmed];
  try {
    return parseAllowedRoles(JSON.parse(trimmed));
  } catch {
    return [];
  }
}

export function decodeHasuraAllowedRoles(token: string): string[] {
  return parseAllowedRoles(readHasuraClaims(token)?.['x-hasura-allowed-roles']);
}

export function tokenAllowsHasuraRole(token: string, role: string): boolean {
  return decodeHasuraAllowedRoles(token).includes(role);
}

/** Role header for the business live-orders socket. Empty when it must not be sent. */
export function businessHasuraRoleHeaders(
  token: string | null | undefined,
  persona: string | null | undefined
): Record<string, string> {
  if (!token || persona !== 'business') return {};
  if (!tokenAllowsHasuraRole(token, 'business')) return {};
  return { 'x-hasura-role': 'business' };
}
