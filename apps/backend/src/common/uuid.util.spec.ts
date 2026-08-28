import { HttpException, HttpStatus } from '@nestjs/common';
import { isUuid, requireUuid } from './uuid.util';

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
