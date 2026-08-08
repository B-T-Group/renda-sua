import { resolveTrackViewerFromRequest } from './resolve-track-viewer';

function unsignedHasuraJwt(userId: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' })
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': userId,
        'x-hasura-default-role': 'client',
        'x-hasura-allowed-roles': ['client'],
      },
    })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

describe('resolveTrackViewerFromRequest', () => {
  it('marks Hasura JWT viewers as jwtVerified for PII enrichment', () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const result = resolveTrackViewerFromRequest({
      headers: {
        authorization: `Bearer ${unsignedHasuraJwt(userId)}`,
        'x-user-id': 'spoofed-user',
      },
      ip: '203.0.113.1',
    });

    expect(result).toEqual({
      viewerType: 'user',
      viewerId: userId,
      jwtVerified: true,
    });
  });

  it('does not trust X-User-Id alone for enrichment', () => {
    const result = resolveTrackViewerFromRequest({
      headers: {
        'x-user-id': 'header-user',
      },
    });

    expect(result).toEqual({
      viewerType: 'user',
      viewerId: 'header-user',
      jwtVerified: false,
    });
  });

  it('falls through invalid Bearer tokens to headers', () => {
    const result = resolveTrackViewerFromRequest({
      headers: {
        authorization: 'Bearer not-a-jwt',
        'x-anonymous-id': 'anon-1',
      },
    });

    expect(result).toEqual({
      viewerType: 'anon',
      viewerId: 'anon-1',
      jwtVerified: false,
    });
  });

  it('uses ip|ua when no identity headers are present', () => {
    const result = resolveTrackViewerFromRequest({
      headers: {
        'user-agent': 'TestAgent/1.0',
      },
      ip: '198.51.100.9',
    });

    expect(result).toEqual({
      viewerType: 'ip_ua',
      viewerId: '198.51.100.9|TestAgent/1.0',
      jwtVerified: false,
    });
  });
});
