/** Meta Pixel ID used in index.html `fbq('init', ...)`. */
export const META_PIXEL_ID = '2008683340063278';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    const raw = trimmed.slice(name.length + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function readFbclidFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return new URLSearchParams(window.location.search).get('fbclid') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ensure `_fbc` exists: prefer the Pixel cookie; if missing but `fbclid` is in
 * the URL, construct Meta's `fb.1.<ms>.<fbclid>` format and persist it.
 */
export function ensureMetaFbc(): string | undefined {
  const existing = readCookie('_fbc')?.trim();
  if (existing) return existing;
  const fbclid = readFbclidFromUrl()?.trim();
  if (!fbclid) return undefined;
  const constructed = `fb.1.${Date.now()}.${fbclid}`;
  // Meta recommends ~90 days retention for click ids.
  writeCookie('_fbc', constructed, 90 * 24 * 60 * 60);
  return constructed;
}

export function getMetaFbp(): string | undefined {
  return readCookie('_fbp')?.trim() || undefined;
}

/** Browser ids + page URL to attach to CAPI track payloads. */
export function getMetaBrowserContext(): {
  fbc?: string;
  fbp?: string;
  eventSourceUrl?: string;
} {
  if (typeof window === 'undefined') return {};
  const fbc = ensureMetaFbc();
  const fbp = getMetaFbp();
  return {
    ...(fbc && { fbc }),
    ...(fbp && { fbp }),
    eventSourceUrl: window.location.href,
  };
}
