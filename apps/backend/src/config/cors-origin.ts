const DEFAULT_CORS_ORIGIN = 'http://localhost:4200';

export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw || DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowlist: string[]
): boolean {
  if (!origin) {
    return false;
  }
  return allowlist.includes('*') || allowlist.includes(origin);
}
