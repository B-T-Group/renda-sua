import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
  isInviteExpired,
} from './token.util';

describe('token.util', () => {
  it('hashes invite tokens with sha256 hex', () => {
    const token = 'a'.repeat(64);
    expect(hashInviteToken(token)).toHaveLength(64);
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toBe(hashInviteToken('b'.repeat(64)));
    expect(hashInviteToken(token)).not.toBe(token);
  });

  it('generates a 64-char hex token', () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(generateInviteToken()).not.toBe(token);
  });

  it('expires invites after the configured days', () => {
    const from = new Date('2026-08-14T12:00:00.000Z');
    const expires = inviteExpiresAt(7, from);
    expect(expires.toISOString()).toBe('2026-08-21T12:00:00.000Z');
    expect(isInviteExpired(expires, from)).toBe(false);
    expect(isInviteExpired(expires, expires)).toBe(true);
    expect(isInviteExpired('2026-08-13T12:00:00.000Z', from)).toBe(true);
  });
});
