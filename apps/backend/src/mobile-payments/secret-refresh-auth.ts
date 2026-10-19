import { createHash, timingSafeEqual } from 'crypto';

/**
 * MyPVit secret-reception webhook (POST /mobile-payments/secret-refresh/:token).
 *
 * MyPVit posts the new operation-account secret to a URL we register in its merchant portal
 * ("URL de réception de clé secrète"). It documents no signature or custom header for that
 * call, so authentication is:
 *  1. a long random token embedded in the registered URL path, kept in Secrets Manager as
 *     MYPVIT_SECRET_REFRESH_TOKEN and compared in constant time, and
 *  2. MyPVit's documented outbound IPs (docs.mypvit.pro, "liste blanche"), overridable with
 *     MYPVIT_SECRET_REFRESH_ALLOWED_IPS.
 * Anything missing or misconfigured fails closed.
 */

/** Public IPs MyPVit documents for traffic from https://api.mypvit.pro. */
export const MYPVIT_DOCUMENTED_IPS: readonly string[] = [
  '176.31.65.18',
  '176.31.65.20',
  '176.31.65.21',
  '13.59.249.167',
];

/** Shortest token we accept as configured (32 chars ≈ 190 bits of base64url). */
export const MIN_SECRET_REFRESH_TOKEN_LENGTH = 32;

/**
 * Constant-time token comparison. Both sides are hashed first so the compare runs over
 * equal-length buffers and leaks neither content nor length.
 */
export function secretRefreshTokenMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/** Strips the IPv4-mapped IPv6 prefix Express reports for IPv4 clients. */
export function normalizeIp(ip: string | undefined | null): string {
  const value = String(ip ?? '').trim();
  return value.startsWith('::ffff:') ? value.slice('::ffff:'.length) : value;
}

/** Allowed source IPs: MYPVIT_SECRET_REFRESH_ALLOWED_IPS (comma separated) or MyPVit's list. */
export function allowedSecretRefreshIps(raw: string | undefined): string[] {
  const configured = String(raw ?? '')
    .split(',')
    .map((ip) => normalizeIp(ip))
    .filter(Boolean);
  return configured.length > 0 ? configured : [...MYPVIT_DOCUMENTED_IPS];
}

/**
 * Secrets Manager secret that holds the MyPVit keys (used by both the webhook writer and
 * MyPVitService's reader). An explicit MYPVIT_SECRET_NAME wins. Otherwise the same rule as
 * main.ts, which loads the backend secrets: DEPLOYMENT_ENV (then NODE_ENV) === 'production'
 * gives production-rendasua-backend-secrets, anything else development-rendasua-backend-secrets.
 * Previously the name was built from raw NODE_ENV, which could target a secret that doesn't exist.
 */
export function mypvitSecretName(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.MYPVIT_SECRET_NAME?.trim();
  if (explicit) return explicit;
  const deploymentEnv = env.DEPLOYMENT_ENV || env.NODE_ENV || 'development';
  return deploymentEnv === 'production'
    ? 'production-rendasua-backend-secrets'
    : 'development-rendasua-backend-secrets';
}

/** First argument that is a string with non-whitespace content (returned trimmed), else undefined. */
export function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return undefined;
}
