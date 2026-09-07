import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { isUuid, requireAuthUserUuid, requireUuid } from './uuid.util';

describe('isUuid', () => {
  it('accepts a canonical UUID', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
  });

  it('rejects blank, malformed, and non-UUID values', () => {
    expect(isUuid('')).toBe(false);
    expect(isUuid('   ')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('f855d3b1c92f431aa6711ce1dcd0e868')).toBe(false);
    expect(isUuid('email|6a95505255ad3b18af9e159f')).toBe(false);
    expect(isUuid('auth0|abc123')).toBe(false);
    expect(isUuid('auth0|test-phone|+24174000000')).toBe(false);
  });
});

describe('requireUuid', () => {
  it('returns a trimmed UUID', () => {
    expect(requireUuid(' 11111111-1111-4111-8111-111111111111 ', 'id')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('throws HTTP 400 for an invalid value', () => {
    try {
      requireUuid('not-a-uuid', 'lastReadMessageId');
      fail('expected throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.message).toBe('lastReadMessageId must be a UUID');
    }
  });
});

describe('requireAuthUserUuid', () => {
  it('returns a trimmed UUID', () => {
    expect(
      requireAuthUserUuid(' 11111111-1111-4111-8111-111111111111 ')
    ).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('throws HTTP 401 for Auth0 email and phone subjects with helpful hint', () => {
    const testCases = [
      { sub: 'email|6a95505255ad3b18af9e159f', expectedPrefix: 'email' },
      { sub: 'auth0|test-phone|+24174000000', expectedPrefix: 'auth0' },
      { sub: 'sms|+237670000000', expectedPrefix: 'sms' },
    ];

    for (const { sub, expectedPrefix } of testCases) {
      try {
        requireAuthUserUuid(sub);
        fail(`expected throw for ${sub}`);
      } catch (error: any) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.message).toContain('user id is not a UUID');
        expect(error.message).toContain(`Auth0 sub detected: ${expectedPrefix}|`);
        expect(error.message).toContain('Auth0 Action must look up the database user UUID');
      }
    }
  });

  it('throws HTTP 401 for non-UUID without Auth0 hint', () => {
    try {
      requireAuthUserUuid('not-a-uuid');
      fail('expected throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Invalid authentication token: user id is not a UUID');
      expect(error.message).not.toContain('Auth0 sub detected');
    }
  });
});
