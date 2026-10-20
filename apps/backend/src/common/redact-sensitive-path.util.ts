/**
 * Some public webhook URLs carry a credential in the path. The MyPVit secret-reception URL is
 * /mobile-payments/secret-refresh/<token>, because MyPVit cannot send a header or signature.
 * Anything that records request paths or URLs (access log, exception log, Sentry tags and
 * events) must pass them through here so the token never lands in logs or Sentry.
 */
const SENSITIVE_PATH_SEGMENT = /(\/secret-refresh\/)[^/?#\s"'<>]+/gi;
const MAX_DEPTH = 8;

export function redactSensitivePath(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return value;
  return value.replace(SENSITIVE_PATH_SEGMENT, '$1[REDACTED]');
}

/** Redacts sensitive path segments in every string of a (Sentry event-like) object, in place. */
export function redactSensitivePathsDeep<T>(value: T): T {
  return walk(value, 0, new WeakSet<object>()) as T;
}

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactSensitivePath(value);
  if (!value || typeof value !== 'object' || depth > MAX_DEPTH) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = walk(value[i], depth + 1, seen);
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    try {
      record[key] = walk(record[key], depth + 1, seen);
    } catch {
      // Read-only or exotic property: leave it.
    }
  }
  return value;
}
