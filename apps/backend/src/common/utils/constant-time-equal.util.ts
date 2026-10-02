import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for shared secrets. Both sides are hashed first so the
 * comparison is over equal-length buffers (no length leak, no timingSafeEqual length throw).
 */
export function constantTimeEqual(
  provided: string | undefined | null,
  expected: string | undefined | null
): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}
