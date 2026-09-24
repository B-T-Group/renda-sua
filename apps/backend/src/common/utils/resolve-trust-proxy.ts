const EXPRESS_KEYWORDS = new Set(['loopback', 'true', 'false']);

function defaultTrustProxy(): number | string {
  return process.env.NODE_ENV === 'production' ? 1 : 'loopback';
}

function isHopCount(value: string): boolean {
  return /^\d+$/.test(value);
}

export function resolveTrustProxy(
  raw: string | undefined
): number | string | string[] {
  if (raw === undefined || raw.trim() === '') {
    return defaultTrustProxy();
  }

  const trimmed = raw.trim();
  if (isHopCount(trimmed)) {
    return Number(trimmed);
  }

  const lower = trimmed.toLowerCase();
  if (EXPRESS_KEYWORDS.has(lower)) {
    return lower;
  }

  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return trimmed;
}
