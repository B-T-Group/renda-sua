/**
 * Where the floating assistant launcher ("Renda orb") may show on web (spec #451 §1).
 * Show only on this allowlist; everything else is hidden (cart, checkout, place
 * order, payment, confirmation, auth, chat surfaces, agent/business routes …).
 */

type RouteRule = { pattern: RegExp; screen: string; desktopOnly?: boolean };

const ORDER_SUBPAGES = new Set(['awaiting-payment', 'confirmation', 'batch']);

const ROUTES: RouteRule[] = [
  { pattern: /^\/$/, screen: 'home' },
  { pattern: /^\/items\/?$/, screen: 'items' },
  { pattern: /^\/foods\/?$/, screen: 'foods' },
  { pattern: /^\/rentals\/?$/, screen: 'rentals' },
  { pattern: /^\/stores\/?$/, screen: 'stores' },
  { pattern: /^\/store\/[^/]+\/?$/, screen: 'store_detail' },
  { pattern: /^\/likes\/?$/, screen: 'likes' },
  { pattern: /^\/orders\/?$/, screen: 'orders' },
  { pattern: /^\/orders\/[^/]+\/?$/, screen: 'order_detail' },
  // Mobile item detail has the sticky order bar; the header entry shows there instead.
  { pattern: /^\/items\/[^/]+\/?$/, screen: 'item_detail', desktopOnly: true },
];

function matchRule(pathname: string): RouteRule | null {
  for (const rule of ROUTES) {
    if (!rule.pattern.test(pathname)) continue;
    if (rule.screen === 'order_detail') {
      const seg = pathname.split('/')[2];
      if (ORDER_SUBPAGES.has(seg)) return null;
    }
    return rule;
  }
  return null;
}

/** True when the launcher may show on this route (persona and flag are checked by the caller). */
export function isAssistantOrbRoute(
  pathname: string,
  isMobile: boolean
): boolean {
  const rule = matchRule(pathname);
  if (!rule) return false;
  return !(rule.desktopOnly && isMobile);
}

/**
 * Names for routes outside the launcher allowlist, where client/guest get the header
 * character instead. Without them every header_icon impression would report
 * `screen: other` and the once-per-screen dedupe would collapse them into one.
 */
const NON_ORB_SCREENS: Array<[RegExp, string]> = [
  [/^\/cart\/?$/, 'cart'],
  [/^\/checkout\/?$/, 'checkout'],
  [/^\/items\/[^/]+\/place_order(?:\/anon-address)?\/?$/, 'place_order'],
  [/^\/orders\/awaiting-payment\/?$/, 'awaiting_payment'],
  [/^\/orders\/confirmation\/?$/, 'order_confirmation'],
  [/^\/orders\/batch\/?$/, 'order_batch'],
  [/^\/orders\/[^/]+\/messages\/?$/, 'order_messages'],
  [/^\/messages\/?$/, 'messages'],
  [/^\/rentals\/(?:requests|request-submitted)\/?$/, 'rental_requests'],
  [/^\/rentals\/[^/]+\/?$/, 'rental_detail'],
  [/^\/categories\/?$/, 'categories'],
  [/^\/collections\/?$/, 'collections'],
  [/^\/collections\/[^/]+\/?$/, 'collection_detail'],
  [/^\/deals\/?$/, 'deals'],
  [/^\/support(?:\/.*)?$/, 'support'],
  [/^\/profile(?:\/.*)?$/, 'profile'],
];

/**
 * Route name for analytics `screen` (the #458 validator accepts [A-Za-z0-9_.-]{1,40};
 * raw paths with ids are never sent).
 */
export function assistantScreenName(pathname: string): string {
  if (pathname === '/assistant' || pathname === '/assistant/')
    return 'assistant';
  const orb = matchRule(pathname);
  if (orb) return orb.screen;
  for (const [pattern, screen] of NON_ORB_SCREENS) {
    if (pattern.test(pathname)) return screen;
  }
  return 'other';
}

export interface AssistantEntryInputs {
  flagOn: boolean;
  /** Signed-out guest, or a signed-in user whose active persona is client. */
  isClientOrGuest: boolean;
  pathname: string;
  isMobile: boolean;
}

/** The floating launcher shows (before transient suppressors such as an open keyboard). */
export function shouldShowAssistantLauncher(i: AssistantEntryInputs): boolean {
  return (
    i.flagOn && i.isClientOrGuest && isAssistantOrbRoute(i.pathname, i.isMobile)
  );
}

/**
 * D2 (eng plan §6.2.1): for client/guest with the flag on, the orb replaces the
 * floating WhatsApp bubble on orb routes and on /assistant, so only one floating
 * bubble ever shows. Elsewhere (cart, checkout, auth …) the bubble keeps today's behaviour.
 */
export function orbReplacesWhatsApp(i: AssistantEntryInputs): boolean {
  return (
    i.flagOn &&
    i.isClientOrGuest &&
    (isAssistantOrbRoute(i.pathname, i.isMobile) || i.pathname === '/assistant')
  );
}

/**
 * `pending`: client/guest while the client flags (or a signed-in persona) are still
 * resolving; the header keeps the slot but shows nothing yet (no icon flash).
 */
export type HeaderAssistantEntry = 'icon' | 'character' | 'hidden' | 'pending';

/**
 * Site header assistant button. One entry point at a time: hidden where the
 * launcher shows and on /assistant itself; elsewhere client/guest get the 28 px
 * character (dot eyes). Flag off, or agent/business: today's SmartToy icon.
 */
export function headerAssistantEntry(
  i: AssistantEntryInputs
): HeaderAssistantEntry {
  if (!i.flagOn || !i.isClientOrGuest) return 'icon';
  if (i.pathname === '/assistant' || i.pathname === '/assistant/')
    return 'hidden';
  if (shouldShowAssistantLauncher(i)) return 'hidden';
  return 'character';
}
