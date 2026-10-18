const EXPRESS_KEYWORDS = new Set(['loopback', 'true', 'false']);

/** NODE_ENV or DEPLOYMENT_ENV is `production` (case-insensitive, trimmed). */
export function isProductionEnv(env: Record<string, string | undefined>): boolean {
  return (
    env.NODE_ENV?.trim().toLowerCase() === 'production' ||
    env.DEPLOYMENT_ENV?.trim().toLowerCase() === 'production'
  );
}

function defaultTrustProxy(): number | string {
  return isProductionEnv(process.env) ? 1 : 'loopback';
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

/**
 * QA #593: in production the backend sits behind exactly one proxy (the Lightsail container
 * load balancer), so Express must trust exactly 1 hop. Then req.ip is the address the LB
 * appended to X-Forwarded-For, which a client can't spoof. `true` or 2+ hops would let a
 * client-supplied X-Forwarded-For entry become req.ip and bypass IP allowlists such as the
 * MyPVit secret-refresh one. 'loopback' would make every request look like it came from the LB.
 * Throws at boot so a bad TRUST_PROXY can't ship silently.
 */
export function assertProductionTrustProxy(
  resolved: number | string | string[],
  env: Record<string, string | undefined> = process.env
): void {
  if (isProductionEnv(env) && resolved !== 1) {
    throw new Error(
      `Refusing to start: trust proxy must be 1 in production (got ${JSON.stringify(resolved)}). ` +
        'Unset TRUST_PROXY or set TRUST_PROXY=1.'
    );
  }
}
