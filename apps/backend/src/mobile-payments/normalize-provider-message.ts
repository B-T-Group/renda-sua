/**
 * Freemopay (and some other MoMo providers) return bilingual error payloads:
 * `{ en: "...", fr: "..." }` instead of a plain string.
 * Hasura `error_message` is TEXT — always coerce before persistence / API responses.
 */
export function normalizeProviderMessage(
  message: unknown,
  fallback = 'Payment failed'
): string {
  if (message == null) return fallback;
  if (typeof message === 'string') {
    const trimmed = message.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof message === 'object') {
    const record = message as Record<string, unknown>;
    for (const key of ['en', 'fr', 'message', 'reason', 'error'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    try {
      return JSON.stringify(message);
    } catch {
      return fallback;
    }
  }
  return String(message);
}
