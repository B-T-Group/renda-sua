import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CommonActions } from '@react-navigation/native';
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
import type { PersonaSlug } from '../types/persona';
import {
  extractAppPath,
  resolveDeepLinkTarget,
  targetPersonaForDeepLinkPath,
  type DeepLinkTarget,
} from '../utils/appDeepLink';
import { isGuestAccessibleDeepLinkPath } from '../utils/appDeepLinkPath';
import {
  canSwitchToPersona,
  isOnPersona,
} from '../utils/notificationPersona';

type PendingDeepLink = {
  path: string;
  routeAttempts: number;
};

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

function guestFoodShellMounted(): boolean {
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
        params: { screen: 'ClientFoods' },
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

function dispatchDeepLinkTarget(
  target: DeepLinkTarget,
  persona: PersonaSlug,
  isDelegation: boolean
): boolean {
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
 * Opens rendasua.com/app/* and rendasua://* links into the active persona shell.
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
    const path = extractAppPath(url);
    if (!path) return;
    pendingRef.current = { path, routeAttempts: 0 };
    flushPending.current();
  });

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
    auth.accessToken,
    personaStore.activePersona,
    personaStore.activeContext,
    personaStore.isDelegationContext,
    personaStore.showMainApp,
    personaStore.pickingPersona,
  ]);
}

type FlushResult = 'wait' | 'retry' | 'hold' | 'done';

type DeepLinkAuth = {
  isAuthenticated: boolean;
  accessToken: string | null;
};

type DeepLinkPersona = {
  showMainApp: boolean;
  activePersona: PersonaSlug;
  personas: PersonaSlug[];
  pickingPersona: PersonaSlug | null;
  isDelegationContext: boolean;
  selectPersona: (persona: PersonaSlug) => Promise<void>;
};

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

function flushOne(
  pending: PendingDeepLink,
  a: DeepLinkAuth,
  p: DeepLinkPersona
): FlushResult {
  const signedIn = a.isAuthenticated && !!a.accessToken && p.showMainApp;
  const guestFoodLink = isGuestAccessibleDeepLinkPath(pending.path);
  if (!signedIn && !guestFoodLink) return 'wait';
  if (!signedIn && guestFoodLink && !guestFoodShellMounted()) return 'hold';
  const required = signedIn ? targetPersonaForDeepLinkPath(pending.path) : null;
  if (required && !isOnRequiredPersona(a, p, required)) {
    maybeSwitchPersona(a, p, required);
    return 'hold';
  }
  const ok = dispatchDeepLinkTarget(
    resolveDeepLinkTarget(pending.path),
    p.activePersona,
    p.isDelegationContext
  );
  return ok ? 'done' : 'retry';
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
