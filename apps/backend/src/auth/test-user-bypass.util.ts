/**
 * Test-user OTP bypass rules (DEV / staging only).
 *
 * A test identity skips the real Auth0 passwordless OTP and logs in through the
 * Email-Test-Users / Phone-Test-Users password connections. Because that skips
 * the code check, the rules are deliberately narrow:
 *
 * - Email: the exact test domain (default `rendasua-test.com`), or an explicit
 *   entry in AUTH0_TEST_EMAIL_ALLOWLIST.
 * - Phone: digits ending in AUTH0_TEST_PHONE_SUFFIX (default `0000`), or an
 *   exact entry in AUTH0_TEST_PHONE_ALLOWLIST. Off entirely in production.
 * - The code must be exactly TEST_USER_OTP_CODE; any other code is rejected.
 * - Never active when NODE_ENV or DEPLOYMENT_ENV is `production`, whatever
 *   AUTH0_TEST_USERS_ENABLED says.
 */
export const TEST_USER_OTP_CODE = '0000';
export const DEFAULT_TEST_PHONE_SUFFIX = '0000';

export interface TestUserMatchConfig {
  emailDomain: string;
  emailAllowlist: string[];
  phoneAllowlist: string[];
  phoneSuffix: string;
}

type EnvLike = Record<string, string | undefined>;

/** True when the process runs as production (either env marker counts). */
export function isProductionRuntime(env: EnvLike = process.env): boolean {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const deploymentEnv = env.DEPLOYMENT_ENV?.trim().toLowerCase();
  return nodeEnv === 'production' || deploymentEnv === 'production';
}

/** Phone comparison key: digits only (`+237 6 54…` -> `2376…`). */
export function normalizeTestPhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

export function normalizeTestEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Comma / whitespace separated list -> trimmed, non-empty entries. */
export function parseTestAllowlist(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function matchesTestEmail(
  email: string | null | undefined,
  config: TestUserMatchConfig
): boolean {
  const normalized = normalizeTestEmail(email);
  if (!normalized || !normalized.includes('@')) return false;
  const allowlisted = config.emailAllowlist.some(
    (entry) => normalizeTestEmail(entry) === normalized
  );
  if (allowlisted) return true;
  const domain = normalizeTestEmail(config.emailDomain).replace(/^@/, '');
  if (!domain) return false;
  return normalized.split('@').pop() === domain;
}

export function matchesTestPhone(
  phone: string | null | undefined,
  config: TestUserMatchConfig
): boolean {
  const digits = normalizeTestPhone(phone);
  if (!digits) return false;
  const allowlisted = config.phoneAllowlist.some(
    (entry) => normalizeTestPhone(entry) === digits
  );
  return allowlisted || matchesTestPhoneSuffix(digits, config.phoneSuffix);
}

function matchesTestPhoneSuffix(digits: string, suffix: string): boolean {
  const needle = normalizeTestPhone(suffix);
  if (!needle || digits.length <= needle.length) return false;
  return digits.endsWith(needle);
}

export function isValidTestOtp(otp: string | null | undefined): boolean {
  return typeof otp === 'string' && otp.trim() === TEST_USER_OTP_CODE;
}
