import { buildRequestContextFromHeaders, extractHasuraClaimsFromToken } from './request-context.util';

function b64Json(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeToken(payload: Record<string, unknown>): string {
  return `h.${b64Json(payload)}.sig`;
}

describe('request-context.util JWT extraction', () => {
  it('extracts default role and allowed roles from Hasura claims', () => {
    const token = makeToken({
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': 'user-1',
        'x-hasura-default-role': 'agent',
        'x-hasura-allowed-roles': ['agent', 'client'],
      },
    });
    expect(extractHasuraClaimsFromToken(token)).toEqual({
      userId: 'user-1',
      defaultRole: 'agent',
      allowedRoles: ['agent', 'client'],
    });
  });

  it('builds RequestContext with jwt persona fields', () => {
    const token = makeToken({
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': 'user-2',
        'x-hasura-default-role': 'business',
        'x-hasura-allowed-roles': '["business"]',
      },
    });
    const ctx = buildRequestContextFromHeaders({
      authorization: `Bearer ${token}`,
    });
    expect(ctx.userId).toBe('user-2');
    expect(ctx.jwtDefaultRole).toBe('business');
    expect(ctx.jwtAllowedRoles).toEqual(['business']);
  });
});
