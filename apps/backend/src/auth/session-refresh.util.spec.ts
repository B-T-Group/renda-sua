import { HttpException, HttpStatus } from '@nestjs/common';
import {
  accessTokenTtlSec,
  canReuseAccessToken,
  isInvalidGrantError,
  requireRefreshToken,
} from './session-refresh.util';

function unsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' })
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

describe('session-refresh.util', () => {
  it('reuses access tokens that expire after the buffer', () => {
    const token = unsignedJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(canReuseAccessToken(token)).toBe(true);
    expect(accessTokenTtlSec(token)).toBeGreaterThan(3000);
  });

  it('does not reuse tokens that expire within the buffer', () => {
    const token = unsignedJwt({
      exp: Math.floor(Date.now() / 1000) + 10,
    });
    expect(canReuseAccessToken(token)).toBe(false);
  });

  it('requires a refresh token for web sessions', () => {
    expect(requireRefreshToken('rt')).toBe('rt');
    expect(() => requireRefreshToken(undefined)).toThrow(HttpException);
  });

  it('does not reuse missing or undecodable access tokens', () => {
    expect(canReuseAccessToken(undefined)).toBe(false);
    expect(canReuseAccessToken('not-a-jwt')).toBe(false);
    expect(accessTokenTtlSec(undefined)).toBeNull();
  });

  it('detects Auth0 invalid_grant from HttpException bodies', () => {
    const error = new HttpException(
      { success: false, error: 'Failed to refresh access token', code: 'invalid_grant' },
      HttpStatus.BAD_REQUEST
    );
    expect(isInvalidGrantError(error)).toBe(true);
    expect(isInvalidGrantError(new Error('network'))).toBe(false);
  });

  it('detects Auth0 invalid_grant from axios-style response bodies', () => {
    expect(
      isInvalidGrantError({
        response: { data: { error: 'invalid_grant' } },
      })
    ).toBe(true);
  });
});
