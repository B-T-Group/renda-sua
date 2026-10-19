import * as crypto from 'crypto';

/**
 * QA #608 N4: constant-time internal key check. Both sides are hashed first so
 * the compare runs on equal-length buffers whatever the caller sent.
 */
export function internalKeyMatches(provided: string | undefined | null, expected: string | undefined | null): boolean {
  if (!expected || typeof provided !== 'string') return false;
  const a = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}
