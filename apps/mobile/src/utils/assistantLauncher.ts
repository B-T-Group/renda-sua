/**
 * Floating assistant launcher rules (#451 spec §1, behind `assistant_launcher_v1`):
 * persona gating, the show-only allowlist, placement next to the cart FAB,
 * the first-run nudge and the attention caps. Pure so vitest covers it.
 */

export type LauncherPersona = 'client' | 'guest';
/** Who is looking at the assistant (agent / business keep the static icon). */
export type AssistantViewer = LauncherPersona | 'agent' | 'business';

export const ASSISTANT_LAUNCHER_FLAG = 'assistant_launcher_v1' as const;

/** Client / guest see the Renda character; agent and business keep smart-toy. */
export function assistantViewer(isAuthenticated: boolean, activePersona: string | null | undefined): AssistantViewer {
  if (!isAuthenticated) return 'guest';
  if (activePersona === 'client') return 'client';
  return activePersona === 'business' ? 'business' : 'agent';
}

export function canSeeRendaCharacter(viewer: AssistantViewer): boolean {
  return viewer === 'client' || viewer === 'guest';
}

const SHARED_BROWSE_ROUTES = ['CategoriesBrowse', 'CollectionDetail', 'StoresList', 'StoreDetail'] as const;

/** Show only here; everything else (checkout, auth, chat, item detail, reels…) hides it. */
export const LAUNCHER_ALLOWLIST: Record<LauncherPersona, ReadonlySet<string>> = {
  client: new Set([
    'ClientBrowse',
    'ClientSearch',
    'ClientOrders',
    'ClientMenu',
    ...SHARED_BROWSE_ROUTES,
    'OrderDetail',
  ]),
  guest: new Set(['GuestBrowse', 'GuestFoods', 'GuestRentals', ...SHARED_BROWSE_ROUTES]),
};

export const TAB_ROUTES: ReadonlySet<string> = new Set([
  'ClientBrowse',
  'ClientSearch',
  'ClientOrders',
  'ClientMenu',
  'GuestBrowse',
  'GuestFoods',
  'GuestRentals',
]);

/** Screens that mount BrowseCartFab (shown when the cart has lines). */
export const CART_FAB_ROUTES: ReadonlySet<string> = new Set([
  'GuestBrowse',
  'GuestFoods',
  'StoreDetail',
  'CollectionDetail',
]);

export function isLauncherRoute(persona: LauncherPersona, route: string | null | undefined): boolean {
  return !!route && LAUNCHER_ALLOWLIST[persona].has(route);
}

export type LauncherVisibilityInput = {
  flagOn: boolean;
  viewer: AssistantViewer;
  route: string | null | undefined;
  /** Deferred mount done (InteractionManager + 1.5 s). */
  mounted: boolean;
  keyboardOpen: boolean;
  /** Open modal / bottom sheet / drawer count (useLauncherSuppressor). */
  suppressed: boolean;
  ftueShowing: boolean;
  marketPromptShowing: boolean;
};

export function shouldShowLauncher(i: LauncherVisibilityInput): boolean {
  if (!i.flagOn || !i.mounted) return false;
  if (i.viewer !== 'client' && i.viewer !== 'guest') return false;
  if (!isLauncherRoute(i.viewer, i.route)) return false;
  return !i.keyboardOpen && !i.suppressed && !i.ftueShowing && !i.marketPromptShowing;
}

/**
 * One entry point at a time: with the flag on, the header assistant button
 * hides wherever the launcher is allowed for a client / guest.
 */
export function shouldHideHeaderAssistantButton(
  flagOn: boolean,
  viewer: AssistantViewer,
  route: string
): boolean {
  if (!flagOn) return false;
  if (viewer !== 'client' && viewer !== 'guest') return false;
  return isLauncherRoute(viewer, route);
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export const LAUNCHER_CHARACTER_SIZE = 52;
export const LAUNCHER_TARGET = 56;
export const CART_FAB_SIZE = 52;
const EDGE = 16; // spacing.md
const GAP = 12; // spacing.sm

export type LauncherPlacementInput = {
  route: string;
  cartFabVisible: boolean;
  tabBarOverlayHeight: number;
  bottomInset: number;
};

/**
 * Bottom/right of the 56 tap target so the 52 character sits where the spec
 * puts it (and its centre lines up with the 52 cart FAB):
 * - tab screens: overlay + 12; stack screens: inset + 16;
 * - with the cart FAB: stacked above it (cartBottom + 52 + 12).
 * The launcher does not ride the pill's hide-on-scroll (resting offset).
 */
export function launcherPlacement(i: LauncherPlacementInput): { right: number; bottom: number } {
  const tab = TAB_ROUTES.has(i.route);
  const inset = (LAUNCHER_TARGET - LAUNCHER_CHARACTER_SIZE) / 2;
  let bottom: number;
  if (i.cartFabVisible) {
    const cartBottom = (tab ? i.tabBarOverlayHeight : i.bottomInset) + EDGE;
    bottom = cartBottom + CART_FAB_SIZE + GAP;
  } else {
    bottom = tab ? i.tabBarOverlayHeight + GAP : i.bottomInset + EDGE;
  }
  return { right: EDGE - inset, bottom: bottom - inset };
}

export function cartFabVisibleOn(route: string, cartLineCount: number): boolean {
  return cartLineCount > 0 && CART_FAB_ROUTES.has(route);
}

// ---------------------------------------------------------------------------
// First-run nudge
// ---------------------------------------------------------------------------

export const NUDGE_STORAGE_KEY = 'assistant.nudge.v1.seen';
export const NUDGE_DWELL_MS = 3000;
export const NUDGE_AUTO_HIDE_MS = 8000;
export const NUDGE_ROUTES: ReadonlySet<string> = new Set(['ClientBrowse', 'GuestBrowse']);

export type NudgeDismissReason = 'close' | 'outside' | 'timeout' | 'opened';

export type NudgeEligibilityInput = {
  /** Already seen on this device (or storage not read yet → treat as seen). */
  seen: boolean | null;
  route: string | null | undefined;
  launcherVisible: boolean;
  ftueComplete: boolean;
  /** Market-change prompt shown at any point this session. */
  marketPromptThisSession: boolean;
};

export function canShowNudge(i: NudgeEligibilityInput): boolean {
  if (i.seen !== false) return false;
  if (!i.route || !NUDGE_ROUTES.has(i.route)) return false;
  return i.launcherVisible && i.ftueComplete && !i.marketPromptThisSession;
}

// ---------------------------------------------------------------------------
// Attention ripple caps: 1 per app session, 3 per 7 days
// ---------------------------------------------------------------------------

export const ATTENTION_STORAGE_KEY = 'assistant.attention.v1.history';
export const ATTENTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const ATTENTION_MAX_PER_WINDOW = 3;
/** Waits for this much scroll / touch idle before playing. */
export const ATTENTION_IDLE_MS = 2000;
export const ATTENTION_DURATION_MS = 1600;

export type AttentionTrigger = 'first_run' | 'zero_results' | 'reorder_eligible';

export function parseAttentionHistory(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

export function pruneAttentionHistory(history: readonly number[], now: number): number[] {
  return history.filter((t) => t <= now && now - t < ATTENTION_WINDOW_MS);
}

export function canPlayAttention(history: readonly number[], now: number, playedThisSession: boolean): boolean {
  if (playedThisSession) return false;
  return pruneAttentionHistory(history, now).length < ATTENTION_MAX_PER_WINDOW;
}

export function recordAttention(history: readonly number[], now: number): number[] {
  return [...pruneAttentionHistory(history, now), now];
}

/** ms to wait before the ripple may play (0 = now). */
export function attentionDelay(lastInteractionAt: number, now: number): number {
  return Math.max(0, ATTENTION_IDLE_MS - (now - lastInteractionAt));
}

// ---------------------------------------------------------------------------
// Settle: idle launcher eases to static after 20 s without interaction
// ---------------------------------------------------------------------------

export const SETTLE_AFTER_MS = 20_000;

export function isSettled(lastInteractionAt: number, now: number): boolean {
  return now - lastInteractionAt >= SETTLE_AFTER_MS;
}
