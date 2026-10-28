import type { PersonaSlug } from '../types/persona';
import {
  resolveDeepLinkTarget,
  targetPersonaForDeepLinkPath,
  type DeepLinkTarget,
} from './appDeepLink';
import { isGuestAccessibleDeepLinkPath } from './appDeepLinkPath';
import { canSwitchToPersona, isOnPersona } from './notificationPersona';

export type PendingDeepLink = {
  path: string;
  routeAttempts: number;
};

/**
 * - `done`  the link was dispatched, drop it
 * - `wait`  needs a signed-in session; re-run when auth / persona state changes
 * - `hold`  a shell switch / mount is in flight; poll again shortly (no attempt cost)
 * - `retry` the target route is not mounted yet; poll again (counts attempts)
 */
export type FlushResult = 'wait' | 'retry' | 'hold' | 'done';

/**
 * The slice of AuthStore the flush reads. The store keeps its token under
 * `tokens.accessToken` (there is no top-level `accessToken`); reading a field
 * that does not exist made every signed-in session look signed out, so deep
 * links were held forever and the app stayed on its dashboard.
 */
export type DeepLinkAuth = {
  isAuthenticated: boolean;
  tokens: { accessToken: string } | null;
};

export type DeepLinkPersona = {
  showMainApp: boolean;
  activePersona: PersonaSlug;
  personas: PersonaSlug[];
  pickingPersona: PersonaSlug | null;
  isDelegationContext: boolean;
  selectPersona: (persona: PersonaSlug) => Promise<void>;
};

export type DeepLinkDispatchContext = {
  persona: PersonaSlug;
  isDelegation: boolean;
  signedIn: boolean;
};

export type DeepLinkFlushDeps = {
  /** True once the guest navigator (GuestTabs) is mounted. */
  guestShellMounted: () => boolean;
  /** Navigates; false when the target route is not mounted yet. */
  dispatch: (target: DeepLinkTarget, ctx: DeepLinkDispatchContext) => boolean;
};

/** Signed in AND the persona shell (not the persona gate / picker) is showing. */
export function isDeepLinkSignedIn(a: DeepLinkAuth, p: DeepLinkPersona): boolean {
  return a.isAuthenticated && !!a.tokens?.accessToken && p.showMainApp;
}

function maybeSwitchPersona(
  a: DeepLinkAuth,
  p: DeepLinkPersona,
  target: PersonaSlug
): void {
  if (
    canSwitchToPersona({
      isAuthenticated: a.isAuthenticated,
      showMainApp: p.showMainApp,
      activePersona: p.activePersona,
      enrolled: p.personas,
      pickingPersona: p.pickingPersona,
      target,
    })
  ) {
    void p.selectPersona(target);
  }
}

function isOnRequiredPersona(
  a: DeepLinkAuth,
  p: DeepLinkPersona,
  target: PersonaSlug
): boolean {
  return isOnPersona({
    isAuthenticated: a.isAuthenticated,
    showMainApp: p.showMainApp,
    activePersona: p.activePersona,
    target,
  });
}

/** One attempt at opening a queued deep link (cold start, warm start, or after auth). */
export function flushDeepLink(
  pending: PendingDeepLink,
  a: DeepLinkAuth,
  p: DeepLinkPersona,
  deps: DeepLinkFlushDeps
): FlushResult {
  const signedIn = isDeepLinkSignedIn(a, p);
  const guestLink = isGuestAccessibleDeepLinkPath(pending.path);
  if (!signedIn && !guestLink) return 'wait';
  if (!signedIn && guestLink && !deps.guestShellMounted()) return 'hold';
  const required = signedIn ? targetPersonaForDeepLinkPath(pending.path) : null;
  if (required && !isOnRequiredPersona(a, p, required)) {
    maybeSwitchPersona(a, p, required);
    return 'hold';
  }
  const ok = deps.dispatch(resolveDeepLinkTarget(pending.path), {
    persona: p.activePersona,
    isDelegation: p.isDelegationContext,
    signedIn,
  });
  return ok ? 'done' : 'retry';
}
