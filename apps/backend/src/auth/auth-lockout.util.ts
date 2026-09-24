import { buildOtpIdentifier } from './otp-send-limiter.util';

/** Redis/in-memory lockout key for a login identifier (known or unknown). */
export function buildIdentifierLockoutKey(params: {
  email?: string | null;
  phone?: string | null;
}): string {
  return `identifier:${buildOtpIdentifier(params)}`;
}
