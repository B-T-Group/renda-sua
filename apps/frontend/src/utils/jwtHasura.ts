const HASURA_CLAIMS = 'https://hasura.io/jwt/claims';

export function decodeHasuraUserIdFromAccessToken(
  token: string
): string | undefined {
  try {
    const part = token.split('.')[1];
    if (!part) return undefined;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Record<string, unknown>;
    const claims = payload[HASURA_CLAIMS] as Record<string, string> | undefined;
    return claims?.['x-hasura-user-id'];
  } catch {
    return undefined;
  }
}
