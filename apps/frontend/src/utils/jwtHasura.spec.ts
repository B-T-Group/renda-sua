import {
  decodeAuth0SubFromToken,
  decodeHasuraUserIdFromAccessToken,
} from './jwtHasura';

function token(payload: object): string {
  const segment = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `hdr.${segment}.sig`;
}

describe('jwtHasura', () => {
  it('reads the Auth0 sub and ignores a non-string sub', () => {
    expect(decodeAuth0SubFromToken(token({ sub: 'auth0|abc' }))).toBe('auth0|abc');
    expect(decodeAuth0SubFromToken(token({ sub: 12 }))).toBeUndefined();
  });

  it('reads the Hasura user id from namespaced claims', () => {
    expect(
      decodeHasuraUserIdFromAccessToken(
        token({
          'https://hasura.io/jwt/claims': { 'x-hasura-user-id': 'uuid-1' },
        })
      )
    ).toBe('uuid-1');
    expect(decodeHasuraUserIdFromAccessToken(token({ sub: 'auth0|abc' }))).toBeUndefined();
  });

  it('returns undefined for a missing or corrupt payload', () => {
    expect(decodeAuth0SubFromToken('not-a-jwt')).toBeUndefined();
    expect(decodeHasuraUserIdFromAccessToken('hdr.')).toBeUndefined();
    expect(decodeAuth0SubFromToken('hdr.@@@.sig')).toBeUndefined();
  });
});
