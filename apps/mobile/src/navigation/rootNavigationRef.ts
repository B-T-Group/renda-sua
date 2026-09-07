import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';
import type { PersonaSlug } from '@/types/persona';
import type { SignupParams } from './types';

export const rootNavigationRef = createNavigationContainerRef();

const PERSONA_DASHBOARD_RESET: Record<PersonaSlug, { root: string; tabScreen: string }> = {
  client: { root: 'ClientMainTabs', tabScreen: 'ClientBrowse' },
  agent: { root: 'MainTabs', tabScreen: 'Dashboard' },
  business: { root: 'BusinessMainTabs', tabScreen: 'BusinessDashboard' },
};

/** Reset the active persona shell to its home tab (browse / dashboard). */
export function resetToPersonaDashboard(persona: PersonaSlug): void {
  if (!rootNavigationRef.isReady()) return;
  const target = PERSONA_DASHBOARD_RESET[persona];
  rootNavigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name: target.root,
          state: {
            index: 0,
            routes: [{ name: target.tabScreen }],
          },
        },
      ],
    })
  );
}

/** Retry dashboard reset until the new persona navigator has mounted. */
export function resetToPersonaDashboardWhenReady(persona: PersonaSlug, maxAttempts = 12): void {
  let attempts = 0;
  const tryReset = () => {
    attempts += 1;
    if (rootNavigationRef.isReady()) {
      resetToPersonaDashboard(persona);
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(tryReset, 50);
    }
  };
  tryReset();
}

/** Root-level route that owns order detail for each persona shell. */
const ORDER_DETAIL_ROOT_ROUTE: Record<'client' | 'agent' | 'business' | 'delegate', string> = {
  client: 'OrderDetail',
  business: 'BusinessOrderDetail',
  agent: 'MainTabs',
  delegate: 'DelegateOrderDetail',
};

/**
 * Opens order detail for the active persona shell. Returns false when that
 * shell is not mounted (persona mismatch / cold start) so callers can retry
 * instead of dispatching an action React Navigation would silently drop.
 */
export function navigateToOrderFromPush(
  orderId: string,
  persona: 'client' | 'agent' | 'business' | 'delegate',
  openMessages?: boolean,
  highlightMessageId?: string,
  rate?: 'agent' | 'item'
): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const target = ORDER_DETAIL_ROOT_ROUTE[persona];
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes(target)) return false;
  const params = { orderId, openMessages, highlightMessageId, rate };
  rootNavigationRef.dispatch(
    persona === 'agent'
      ? CommonActions.navigate({
          name: target,
          params: { screen: 'Orders', params: { screen: 'OrderDetail', params } },
        })
      : CommonActions.navigate({ name: target, params })
  );
  return true;
}

/**
 * Navigate to business locations focused on a transfer request (push tap).
 * Returns false when the business navigator is not mounted yet so callers can retry.
 */
export function navigateToLocationTransferFromPush(requestId: string): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('BusinessLocationsList')) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'BusinessLocationsList',
      params: { transferRequestId: requestId },
    })
  );
  return true;
}

/**
 * Opens AI image cleanup review from a push. Returns false until the business
 * navigator has mounted (persona switch / cold start).
 */
export function navigateToAiImageCleanupFromPush(jobId: string): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('BusinessAiImageCleanupReview')) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'BusinessAiImageCleanupReview',
      params: { jobId },
    })
  );
  return true;
}

/** Opens client item detail after a stock availability result push. */
export function navigateToInventoryItemFromPush(
  inventoryItemId: string,
  availabilityResult?: 'confirmed' | 'adjusted' | 'unavailable',
  availabilityQuantity?: number
): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('InventoryItemDetail')) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'InventoryItemDetail',
      params: {
        inventoryItemId,
        availabilityResult,
        availabilityQuantity,
      },
    })
  );
  return true;
}

/** Navigate the agent shell to the "Available" (open orders) tab. */
export function navigateToAgentOpenOrders(): void {
  if (!rootNavigationRef.isReady()) return;
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'MainTabs',
      params: { screen: 'OpenOrders' },
    })
  );
}

/**
 * Navigate to a thread detail from a push notification.
 * Returns false until the navigator is ready (cold start / persona switch).
 */
export function navigateToThreadFromPush(threadId: string): boolean {
  if (!rootNavigationRef.isReady()) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({ name: 'ThreadDetail', params: { threadId } })
  );
  return true;
}

/**
 * Opens the superuser order intervention detail from an admin_order_risk push.
 * Falls back to the queue when the detail route is unavailable, and returns
 * false while the business navigator is not mounted so callers can retry.
 */
export function navigateToAdminOrderFromPush(orderId: string | null): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('AdminOrders')) return false;
  if (orderId && routeNames.includes('AdminOrderDetail')) {
    rootNavigationRef.dispatch(
      CommonActions.navigate({ name: 'AdminOrderDetail', params: { orderId } })
    );
    return true;
  }
  rootNavigationRef.dispatch(CommonActions.navigate({ name: 'AdminOrders' }));
  return true;
}

/**
 * Opens a WhatsApp inbox conversation from a whatsapp_inbox_message push.
 * Falls back to the inbox list when the conversation route is not mounted.
 */
export function navigateToWhatsAppInboxFromPush(
  conversationId: string | null
): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('AdminWhatsAppInbox')) return false;
  if (conversationId && routeNames.includes('AdminWhatsAppConversation')) {
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'AdminWhatsAppConversation',
        params: { conversationId },
      })
    );
    return true;
  }
  rootNavigationRef.dispatch(
    CommonActions.navigate({ name: 'AdminWhatsAppInbox' })
  );
  return true;
}

/**
 * Navigate to an item AI proposal review from a push tap.
 * Returns false until the business navigator is mounted.
 */
export function navigateToItemAiProposalFromPush(itemId: string): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('BusinessItemAiProposal')) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({ name: 'BusinessItemAiProposal', params: { itemId } })
  );
  return true;
}

/**
 * Navigate to a rental listing AI proposal review from a push tap.
 * Returns false until the business navigator is mounted.
 */
export function navigateToRentalAiProposalFromPush(listingId: string): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('BusinessRentalAiProposal')) return false;
  rootNavigationRef.dispatch(
    CommonActions.navigate({ name: 'BusinessRentalAiProposal', params: { listingId } })
  );
  return true;
}

/**
 * Navigate to Documents from an ID approval/rejection push.
 * Works for business and agent shells (both register Documents).
 */
export function navigateToDocumentsFromPush(): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (!routeNames.includes('Documents')) return false;
  rootNavigationRef.dispatch(CommonActions.navigate({ name: 'Documents' }));
  return true;
}

/**
 * Navigate to the in-app notifications center from any persona.
 */
export function navigateToNotificationsCenter(): void {
  if (!rootNavigationRef.isReady()) return;
  rootNavigationRef.dispatch(CommonActions.navigate({ name: 'NotificationsCenter' }));
}

/**
 * Open guest Signup from any guest screen (tabs or root stack overlays).
 * GuestAuth lives under GuestTabs, so stack screens must nest through GuestTabs.
 */
export function navigateToGuestSignup(params?: SignupParams): void {
  if (!rootNavigationRef.isReady()) return;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (routeNames.includes('GuestTabs')) {
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'GuestTabs',
        params: {
          screen: 'GuestAuth',
          params: {
            screen: 'Signup',
            params,
          },
        },
      })
    );
    return;
  }
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'GuestAuth',
      params: {
        screen: 'Signup',
        params,
      },
    })
  );
}
