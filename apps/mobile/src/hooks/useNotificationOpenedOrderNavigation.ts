import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { navigateToOrderFromPush } from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';
import type { PersonaSlug } from '../types/persona';
import {
  canSwitchToPersona,
  isOnPersona,
} from '../utils/notificationPersona';
import {
  parseOrderPushPayload,
  type ParsedOrderPushPayload,
} from '../utils/parseOrderPushPayload';

let pendingOrderFromNotification: ParsedOrderPushPayload | null = null;
let pendingRetryTimer: ReturnType<typeof setTimeout> | null = null;

const PENDING_RETRY_DELAY_MS = 150;
const PENDING_RETRY_ATTEMPTS = 12;

function parsePushPayload(
  data: Record<string, unknown> | undefined
): ParsedOrderPushPayload | null {
  return parseOrderPushPayload(data);
}

type NavTarget = PersonaSlug | 'delegate';

function tryOpenOrder(
  payload: ParsedOrderPushPayload,
  canOpen: boolean,
  target: NavTarget
): boolean {
  if (!canOpen) return false;
  return navigateToOrderFromPush(
    payload.orderId,
    target,
    payload.openMessages,
    payload.highlightMessageId,
    payload.rate
  );
}

function schedulePendingRetry(flush: () => boolean, attemptsLeft: number): void {
  if (pendingRetryTimer) clearTimeout(pendingRetryTimer);
  if (attemptsLeft <= 0) return;
  pendingRetryTimer = setTimeout(() => {
    pendingRetryTimer = null;
    if (!flush()) schedulePendingRetry(flush, attemptsLeft - 1);
  }, PENDING_RETRY_DELAY_MS);
}

/**
 * Opens OrderDetail when the user taps a push whose data includes orderId.
 * Prefers matching location delegation when `locationId` is present; otherwise
 * switches to `data.persona` (or business) when enrolled.
 */
export function useNotificationOpenedOrderNavigation(navReady: boolean): void {
  const { auth, persona } = useStore();
  const handledInitialResponse = useRef(false);
  const [notificationsMod, setNotificationsMod] = useState<Awaited<
    ReturnType<typeof loadExpoNotifications>
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadExpoNotifications().then((mod) => {
      if (!cancelled) setNotificationsMod(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const activePersona = persona.activePersona as PersonaSlug;
  const canOpenMainApp = auth.isAuthenticated && persona.showMainApp;

  const resolveNavTarget = useCallback(
    (payload: ParsedOrderPushPayload): NavTarget => {
      if (payload.locationId) {
        const match = persona.delegations.find((d) => d.locationId === payload.locationId);
        if (match) return 'delegate';
        // No matching grant — open on the owner business stack.
        return 'business';
      }
      if (persona.isDelegationContext) return 'delegate';
      return payload.persona ?? activePersona;
    },
    [activePersona, persona.delegations, persona.isDelegationContext]
  );

  const isReadyForPayload = useCallback(
    (payload: ParsedOrderPushPayload): boolean => {
      if (!canOpenMainApp) return false;
      if (payload.locationId) {
        const match = persona.delegations.find((d) => d.locationId === payload.locationId);
        if (match) {
          return (
            persona.activeContext?.kind === 'delegation' &&
            persona.activeContext.delegationId === match.id
          );
        }
        // No grant: wait until the delegate shell is torn down.
        if (persona.isDelegationContext) return false;
      }
      const target = payload.persona;
      if (!target) return true;
      return isOnPersona({
        isAuthenticated: auth.isAuthenticated,
        showMainApp: persona.showMainApp,
        activePersona,
        target,
      });
    },
    [auth.isAuthenticated, canOpenMainApp, activePersona, persona]
  );

  const flushPending = useCallback((): boolean => {
    const pending = pendingOrderFromNotification;
    if (!pending) return true;

    if (pending.locationId) {
      const match = persona.delegations.find((d) => d.locationId === pending.locationId);
      if (match) {
        const onDelegation =
          persona.activeContext?.kind === 'delegation' &&
          persona.activeContext.delegationId === match.id;
        if (!onDelegation) {
          // Wait out in-flight persona/delegation picks; do not race another switch.
          if (!persona.pickingPersona && !persona.pickingDelegationId) {
            void persona.selectDelegation(match.id);
          }
          return false;
        }
      } else if (
        persona.isDelegationContext &&
        persona.personas.includes('business')
      ) {
        if (!persona.pickingPersona && !persona.pickingDelegationId) {
          void persona.selectPersona('business');
        }
        return false;
      }
    }

    if (!isReadyForPayload(pending)) return false;
    const navTarget = resolveNavTarget(pending);
    if (!tryOpenOrder(pending, canOpenMainApp, navTarget)) return false;
    pendingOrderFromNotification = null;
    return true;
  }, [canOpenMainApp, isReadyForPayload, persona, resolveNavTarget]);

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromResponse = (data: Record<string, unknown> | undefined): void => {
      const parsed = parsePushPayload(data);
      if (!parsed) return;

      if (parsed.locationId) {
        const match = persona.delegations.find((d) => d.locationId === parsed.locationId);
        if (match) {
          const onDelegation =
            persona.activeContext?.kind === 'delegation' &&
            persona.activeContext.delegationId === match.id;
          if (!onDelegation) {
            pendingOrderFromNotification = parsed;
            if (!persona.pickingPersona && !persona.pickingDelegationId) {
              void persona.selectDelegation(match.id);
            }
            schedulePendingRetry(flushPending, PENDING_RETRY_ATTEMPTS);
            return;
          }
          if (tryOpenOrder(parsed, canOpenMainApp, 'delegate')) return;
          pendingOrderFromNotification = parsed;
          schedulePendingRetry(flushPending, PENDING_RETRY_ATTEMPTS);
          return;
        }
        // No matching grant — exit delegation / switch to owner business stack.
        if (persona.personas.includes('business')) {
          const onOwnerBusiness =
            !persona.isDelegationContext &&
            isOnPersona({
              isAuthenticated: auth.isAuthenticated,
              showMainApp: persona.showMainApp,
              activePersona,
              target: 'business',
            });
          if (!onOwnerBusiness) {
            pendingOrderFromNotification = { ...parsed, persona: 'business' };
            // Delegation keeps activePersona as 'business' while DelegateRoot is
            // mounted — still must selectPersona to leave the grant session.
            if (
              !persona.pickingPersona &&
              (persona.isDelegationContext ||
                canSwitchToPersona({
                  isAuthenticated: auth.isAuthenticated,
                  showMainApp: persona.showMainApp,
                  activePersona,
                  enrolled: persona.personas,
                  pickingPersona: persona.pickingPersona,
                  target: 'business',
                }))
            ) {
              void persona.selectPersona('business');
            }
            schedulePendingRetry(flushPending, PENDING_RETRY_ATTEMPTS);
            return;
          }
        }
      }

      const target = parsed.persona;
      if (
        target &&
        !isOnPersona({
          isAuthenticated: auth.isAuthenticated,
          showMainApp: persona.showMainApp,
          activePersona,
          target,
        })
      ) {
        pendingOrderFromNotification = parsed;
        if (
          canSwitchToPersona({
            isAuthenticated: auth.isAuthenticated,
            showMainApp: persona.showMainApp,
            activePersona,
            enrolled: persona.personas,
            pickingPersona: persona.pickingPersona,
            target,
          })
        ) {
          void persona.selectPersona(target);
        }
        schedulePendingRetry(flushPending, PENDING_RETRY_ATTEMPTS);
        return;
      }

      if (tryOpenOrder(parsed, canOpenMainApp, resolveNavTarget(parsed))) return;
      pendingOrderFromNotification = parsed;
      schedulePendingRetry(flushPending, PENDING_RETRY_ATTEMPTS);
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      openFromResponse(data);
    });

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as Record<string, unknown> | undefined;
        if (parsePushPayload(data) === null) return;
        openFromResponse(data);
        if (typeof notificationsMod.clearLastNotificationResponseAsync === 'function') {
          void notificationsMod.clearLastNotificationResponseAsync();
        }
      });
    }

    return () => sub.remove();
  }, [
    notificationsMod,
    navReady,
    canOpenMainApp,
    activePersona,
    flushPending,
    auth.isAuthenticated,
    persona,
    resolveNavTarget,
  ]);

  useEffect(() => {
    if (!navReady) return;
    flushPending();
  }, [
    navReady,
    flushPending,
    persona.activePersona,
    persona.activeContext,
    persona.pickingPersona,
    persona.pickingDelegationId,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPending();
    });
    return () => sub.remove();
  }, [flushPending]);
}
