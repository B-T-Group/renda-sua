import { timingSafeEqual } from 'crypto';

export function verifyBoldSignWebhookSecret(
  provided: string | undefined,
  expected: string | undefined
): boolean {
  if (!expected?.trim() || !provided?.trim()) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
