/**
 * Universal-link helpers for /app/* → in-web paths / custom schemes.
 * Paths must stay same-origin; reject protocol-relative and absolute URLs.
 */

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._~/-]*$/;
const ABSOLUTE_OR_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** Strip `/app` prefix and neutralize open-redirect payloads (e.g. `//evil.com`). */
export function appRelativeFromLocation(
  pathname: string,
  search = ''
): string {
  let relative = pathname.replace(/^\/app\/?/, '');
  relative = relative.replace(/^\/+/, '');
  if (!relative || ABSOLUTE_OR_SCHEME.test(relative) || relative.includes('\\')) {
    return '';
  }
  const pathOnly = relative.split(/[?#]/)[0];
  if (!SAFE_PATH_SEGMENT.test(pathOnly)) {
    return '';
  }
  const safeSearch =
    search.startsWith('?') && !ABSOLUTE_OR_SCHEME.test(search.slice(1))
      ? search
      : '';
  return `${relative}${safeSearch}`;
}

export function mapAppPathToWeb(path: string): string {
  if (!isSafeSameOriginPath(path)) {
    return '/';
  }
  if (path.startsWith('/wallet')) return '/accounts';
  if (path.startsWith('/verification')) return '/documents';
  if (path.startsWith('/chat/')) {
    const id = path.replace('/chat/', '').split(/[?#]/)[0];
    return `/orders/${id}/messages`;
  }
  if (path.startsWith('/deliveries/')) {
    const id = path.replace('/deliveries/', '').split(/[?#]/)[0];
    return `/orders/${id}`;
  }
  if (path.startsWith('/rentals/requests')) return '/business/rentals/requests';
  // A dish links to the shopper-facing listing rather than the merchant view.
  if (path.startsWith('/foods/')) {
    const id = path.replace('/foods/', '').split(/[?#]/)[0];
    return id ? `/items/${id}` : '/foods';
  }
  if (path.startsWith('/items/')) {
    const id = path.replace('/items/', '').split(/[?#]/)[0];
    return `/business/items/${id}`;
  }
  return path;
}

/** True for `/foo` but not `//host`, `https://…`, or schemed paths. */
export function isSafeSameOriginPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('\\') || ABSOLUTE_OR_SCHEME.test(path)) return false;
  const pathOnly = path.split(/[?#]/)[0];
  return SAFE_PATH_SEGMENT.test(pathOnly);
}

export const ANDROID_APP_PACKAGE = 'com.rendasua.agent';

const NAMED_IN_APP_UA =
  /WhatsApp|FBAN|FBAV|Instagram|Line\/|Twitter|FB_IAB|FBIOS/i;

export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/** WhatsApp / Instagram / Facebook in-app browsers block most custom-scheme redirects. */
export function isInAppBrowser(userAgent: string): boolean {
  if (NAMED_IN_APP_UA.test(userAgent)) return true;
  if (/iPhone|iPad|iPod/i.test(userAgent) && !/Safari/i.test(userAgent)) {
    return true;
  }
  return /Android/i.test(userAgent) && /; wv\)/i.test(userAgent);
}

export function toAppSchemeUrl(appRelative: string): string {
  const cleaned = appRelative.replace(/^\/+/, '');
  if (!cleaned || ABSOLUTE_OR_SCHEME.test(cleaned) || cleaned.includes('\\')) {
    return 'rendasua://';
  }
  return `rendasua://${cleaned}`;
}

/** Android Intent URL so WhatsApp's WebView can hand off to the installed app. */
export function toAndroidIntentUrl(appRelative: string): string {
  const path = appRelative.replace(/^\/+/, '');
  const hostAndPath = path || 'orders';
  return `intent://${hostAndPath}#Intent;scheme=rendasua;package=${ANDROID_APP_PACKAGE};end`;
}

export function openAppHref(appRelative: string, userAgent: string): string {
  if (isAndroidUserAgent(userAgent)) return toAndroidIntentUrl(appRelative);
  return toAppSchemeUrl(appRelative);
}

/** Auto-bounce only in a real browser — in-app WebViews swallow custom schemes. */
export function shouldAutoOpenApp(userAgent: string): boolean {
  return !isInAppBrowser(userAgent);
}
