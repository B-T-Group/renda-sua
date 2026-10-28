import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CommonActions } from '@react-navigation/native';
import { getEnv } from '../config/auth0';
import {
  navigateToAdminOrderFromPush,
  navigateToWhatsAppInboxFromPush,
  navigateToDocumentsFromPush,
  navigateToInventoryItemFromPush,
  navigateToItemAiProposalFromPush,
  navigateToOrderFromPush,
  resetToPersonaDashboard,
  rootNavigationRef,
} from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';
import type { AuthStore } from '../stores/AuthStore';
import type { PersonaStore } from '../stores/PersonaStore';
import type { PersonaSlug } from '../types/persona';
import { extractAppPath, type DeepLinkTarget } from '../utils/appDeepLink';
import {
  flushDeepLink,
  type DeepLinkDispatchContext,
  type PendingDeepLink,
} from '../utils/appDeepLinkFlush';
import { itemWebUrl, storeWebUrl } from '../utils/storeWebUrl';
import { openRestockTarget, restockRoutesReady } from '../navigation/restockNavigation';
import { parseRestockLink, restockTargetToPath } from '../utils/restockDeepLink';

let externalEnqueue: ((url: string) => void) | null = null;
const earlyQueue: string[] = [];

/** Lets other handlers (e.g. push taps) reuse the queue + persona switching. */
export function enqueueAppDeepLink(url: string): void {
  if (externalEnqueue) externalEnqueue(url);
  else earlyQueue.push(url);
}

const MAX_ROUTE_RETRIES = 40;
const RETRY_MS = 500;

const ACCOUNTS_ROUTE: Record<PersonaSlug, string> = {
  client: 'ClientAccounts',
  agent: 'AgentAccounts',
  business: 'BusinessAccounts',
};

function navigateNamedRoute(
  name: string,
  params?: Record<string, string>
): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes(name)) return false;
  rootNavigationRef.dispatch(CommonActions.navigate({ name, params }));
  return true;
}

function navigateAccounts(persona: PersonaSlug): boolean {
  return navigateNamedRoute(ACCOUNTS_ROUTE[persona]);
}

function guestShellMounted(): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  return routeNames.includes('GuestTabs');
}

function navigateFoodBrowse(persona: PersonaSlug): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (persona === 'client' && routeNames.includes('ClientMainTabs')) {
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'ClientMainTabs',
        params: { screen: 'ClientBrowse', params: { segment: 'food' } },
      })
    );
    return true;
  }
  if (routeNames.includes('GuestTabs')) {
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'GuestTabs',
        params: { screen: 'GuestFoods' },
      })
    );
    return true;
  }
  return false;
}

function navigateRentalBooking(
  bookingId: string,
  persona: PersonaSlug
): boolean {
  if (persona === 'business') {
    return navigateNamedRoute('BusinessRentalBookingDetail', { bookingId });
  }
  if (persona === 'client') {
    return navigateNamedRoute('RentalBookingDetail', { bookingId });
  }
  return false;
}

/**
 * Catalog item detail lives in the client and guest shells. Agent, business and
 * delegation shells have no such screen, so a public item link opens the web
 * page in-app instead of switching persona.
 */
function openInventoryItem(id: string, ctx: DeepLinkDispatchContext): boolean {
  if (navigateToInventoryItemFromPush(id)) return true;
  const shellHasNoItemDetail =
    ctx.signedIn && (ctx.isDelegation || ctx.persona !== 'client');
  if (!shellHasNoItemDetail || !rootNavigationRef.isReady()) return false;
  void WebBrowser.openBrowserAsync(itemWebUrl(id, getEnv().apiUrl));
  return true;
}

export function dispatchDeepLinkTarget(
  target: DeepLinkTarget,
  ctx: DeepLinkDispatchContext
): boolean {
  const { persona, isDelegation } = ctx;
  const orderShell = isDelegation ? 'delegate' : persona;
  if (target.type === 'order') {
    return navigateToOrderFromPush(target.id, orderShell, target.openMessages);
  }
  if (target.type === 'adminOrder') {
    return navigateToAdminOrderFromPush(target.id);
  }
  if (target.type === 'whatsappInbox') {
    return navigateToWhatsAppInboxFromPush(target.id);
  }
  if (target.type === 'itemProposal') {
    return navigateToItemAiProposalFromPush(target.id);
  }
  if (target.type === 'inventoryItem') {
    return openInventoryItem(target.id, ctx);
  }
  if (
    (target.type === 'restockItem' || target.type === 'restockLikes') &&
    !restockRoutesReady()
  ) {
    return false;
  }
  if (target.type === 'restockItem') {
    void openRestockTarget({ type: 'item', itemId: target.itemId });
    return true;
  }
  if (target.type === 'restockLikes') {
    void openRestockTarget({ type: 'likes', filter: target.filter });
    return true;
  }
  if (target.type === 'store' && isDelegation) {
    void WebBrowser.openBrowserAsync(storeWebUrl(target.id, getEnv().apiUrl));
    return true;
  }
  return dispatchDeepLinkRest(target, persona);
}

function dispatchDeepLinkRest(
  target: DeepLinkTarget,
  persona: PersonaSlug
): boolean {
  if (target.type === 'wallet') return navigateAccounts(persona);
  if (target.type === 'verification') return navigateToDocumentsFromPush();
  if (target.type === 'rentalRequests') {
    return navigateNamedRoute('BusinessRentalsStudio');
  }
  if (target.type === 'rental') return navigateRentalBooking(target.id, persona);
  if (target.type === 'food' && target.id) {
    return navigateToInventoryItemFromPush(target.id);
  }
  if (target.type === 'food') return navigateFoodBrowse(persona);
  if (target.type === 'store') {
    return navigateNamedRoute('StoreDetail', { businessId: target.id });
  }
  if (target.type === 'dedicatedAgents') {
    return navigateNamedRoute('BusinessLocationDedicatedAgents', {
      locationId: target.locationId,
    });
  }
  if (target.type === 'dedicatedApplicants') {
    return navigateNamedRoute('DedicatedApplicants', {
      locationId: target.locationId,
      postingId: target.postingId,
    });
  }
  resetToPersonaDashboard(persona);
  return true;
}

function isInviteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^\/invite(\/|$)/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Opens rendasua.com/app/*, rendasua.com/store/:id, rendasua.com/items/:id[/seo] and rendasua://* links into the active persona shell.
 * Queues until auth + navigation are ready (same pattern as push opens).
 */
export function useAppDeepLinkNavigation(navReady: boolean): void {
  const { auth, persona: personaStore } = useStore();
  const pendingRef = useRef<PendingDeepLink | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authRef = useRef(auth);
  const personaStoreRef = useRef(personaStore);
  authRef.current = auth;
  personaStoreRef.current = personaStore;

  const scheduleRetry = useRef(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => flushPending.current(), RETRY_MS);
  });

  const flushPending = useRef(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const result = flushOne(pending, authRef.current, personaStoreRef.current);
    if (result === 'done') {
      pendingRef.current = null;
      return;
    }
    if (result === 'wait') return;
    if (result === 'hold') {
      scheduleRetry.current();
      return;
    }
    if (pending.routeAttempts >= MAX_ROUTE_RETRIES) {
      pendingRef.current = null;
      return;
    }
    pending.routeAttempts += 1;
    scheduleRetry.current();
  });

  const queue = useRef((url: string | null) => {
    if (!url) return;
    if (isInviteUrl(url)) {
      void WebBrowser.openBrowserAsync(url);
      return;
    }
    // Restock links share `items/:id` with business item proposals; the
    // `src=restock_alert` query (dropped by extractAppPath) tells them apart.
    const restock = parseRestockLink(url);
    const path = restock ? restockTargetToPath(restock) : extractAppPath(url);
    if (!path) return;
    pendingRef.current = { path, routeAttempts: 0 };
    flushPending.current();
  });

  useEffect(() => {
    externalEnqueue = (url) => queue.current(url);
    while (earlyQueue.length) queue.current(earlyQueue.shift() as string);
    return () => {
      externalEnqueue = null;
    };
  }, []);

  useEffect(() => {
    if (!navReady) return;
    void Linking.getInitialURL().then(url => queue.current(url));
    const sub = Linking.addEventListener('url', ({ url }) => queue.current(url));
    return () => {
      sub.remove();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [navReady]);

  useEffect(() => {
    if (!navReady) return;
    flushPending.current();
  }, [
    navReady,
    auth.isAuthenticated,
    auth.tokens?.accessToken,
    personaStore.activePersona,
    personaStore.activeContext,
    personaStore.isDelegationContext,
    personaStore.showMainApp,
    personaStore.pickingPersona,
  ]);
}

const flushDeps = {
  guestShellMounted,
  dispatch: dispatchDeepLinkTarget,
};

function flushOne(
  pending: PendingDeepLink,
  a: AuthStore,
  p: PersonaStore
) {
  return flushDeepLink(pending, a, p, flushDeps);
}
