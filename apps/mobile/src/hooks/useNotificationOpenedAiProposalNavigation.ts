import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import {
  navigateToItemAiProposalFromPush,
  navigateToRentalAiProposalFromPush,
} from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';

type PendingProposal =
  | { type: 'item'; id: string }
  | { type: 'rental'; id: string }
  | null;

let pendingProposal: PendingProposal = null;

function parseProposal(
  data: Record<string, unknown> | undefined
): PendingProposal {
  if (!data) return null;
  const type = typeof data.type === 'string' ? data.type : '';
  if (type === 'ai_item_proposal') {
    const itemId = typeof data.itemId === 'string' ? data.itemId.trim() : '';
    if (itemId) return { type: 'item', id: itemId };
  }
  if (type === 'ai_rental_proposal') {
    const listingId =
      typeof data.listingId === 'string' ? data.listingId.trim() : '';
    if (listingId) return { type: 'rental', id: listingId };
  }
  return null;
}

function navigateWhenReady(
  proposal: NonNullable<PendingProposal>,
  maxAttempts = 20
): void {
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    const navigated =
      proposal.type === 'item'
        ? navigateToItemAiProposalFromPush(proposal.id)
        : navigateToRentalAiProposalFromPush(proposal.id);
    if (navigated) return;
    if (attempts < maxAttempts) {
      setTimeout(tryNavigate, 250);
      return;
    }
    pendingProposal = proposal;
  };
  tryNavigate();
}

/**
 * Opens AI proposal review (item or rental listing) when the business user
 * taps a push notification. Switches to the business persona first when needed.
 */
export function useNotificationOpenedAiProposalNavigation(
  navReady: boolean
): void {
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

  const canOpenBusinessApp =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona === 'business';

  const canSwitchToBusiness =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona !== 'business' &&
    persona.personas.includes('business') &&
    !persona.pickingPersona;

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromResponse = (
      data: Record<string, unknown> | undefined
    ): void => {
      const proposal = parseProposal(data);
      if (!proposal) return;
      if (canOpenBusinessApp) {
        navigateWhenReady(proposal);
        return;
      }
      pendingProposal = proposal;
      if (canSwitchToBusiness) {
        void persona.selectPersona('business');
      }
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        openFromResponse(data);
      }
    );

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void notificationsMod
        .getLastNotificationResponseAsync()
        .then((last) => {
          if (!last) return;
          const data = last.notification.request.content.data as
            | Record<string, unknown>
            | undefined;
          if (parseProposal(data) === null) return;
          openFromResponse(data);
          if (
            typeof notificationsMod.clearLastNotificationResponseAsync ===
            'function'
          ) {
            void notificationsMod.clearLastNotificationResponseAsync();
          }
        });
    }

    return () => sub.remove();
  }, [
    notificationsMod,
    navReady,
    canOpenBusinessApp,
    canSwitchToBusiness,
    persona,
  ]);

  useEffect(() => {
    if (!navReady || !canOpenBusinessApp) return;
    const pending = pendingProposal;
    if (!pending) return;
    pendingProposal = null;
    navigateWhenReady(pending);
  }, [navReady, canOpenBusinessApp, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !canOpenBusinessApp) return;
      const pending = pendingProposal;
      if (!pending) return;
      pendingProposal = null;
      navigateWhenReady(pending);
    });
    return () => sub.remove();
  }, [canOpenBusinessApp]);
}
