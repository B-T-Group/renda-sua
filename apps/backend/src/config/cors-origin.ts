/**
 * Production origins that must ALWAYS be allowed, regardless of CORS_ORIGIN env var.
 * This prevents production outages from misconfigured Secrets Manager values.
 */
const REQUIRED_PRODUCTION_ORIGINS = [
  'https://www.rendasua.com',
  'https://rendasua.com',
] as const;

const DEFAULT_LOCAL_ORIGIN = 'http://localhost:4200';

export function parseCorsOrigins(raw: string | undefined): string[] {
  const envOrigins = (raw || DEFAULT_LOCAL_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Always include production origins as a safety net
  const allOrigins = [...REQUIRED_PRODUCTION_ORIGINS, ...envOrigins];

  // Deduplicate while preserving order
  return Array.from(new Set(allOrigins));
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowlist: string[]
): boolean {
  // Reject empty-string Origin (malformed header)
  if (origin === '') {
    return false;
  }
  // Allow requests without Origin header (non-browser clients, server-to-server)
  if (origin === undefined) {
    return true;
  }
  return allowlist.includes('*') || allowlist.includes(origin);
}
