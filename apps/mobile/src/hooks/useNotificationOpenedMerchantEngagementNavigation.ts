import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { rootNavigationRef, resetToPersonaDashboard } from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';
import { useProfileMe } from './useProfileMe';

const ENGAGEMENT_TYPES = new Set([
  'business_add_item',
  'business_ai_tokens',
  'business_ai_cleanup',
  'business_dashboard',
  'business_location_hours',
  'business_orders',
  'business_items_rejected',
  'business_share_store',
  'business_item_edit',
]);

let pendingType: string | null = null;

function parseType(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const type = typeof data.type === 'string' ? data.type : '';
  return ENGAGEMENT_TYPES.has(type) ? type : null;
}

function navigateEngagement(type: string, businessId?: string | null): boolean {
  if (!rootNavigationRef.isReady()) return false;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  const go = (name: string, params?: object) => {
    if (!routeNames.includes(name) && name !== 'BusinessMainTabs') return false;
    rootNavigationRef.dispatch(CommonActions.navigate({ name, params }));
    return true;
  };
  switch (type) {
    case 'business_dashboard':
      resetToPersonaDashboard('business');
      return true;
    case 'business_add_item':
      return go('BusinessAddItemFromImage');
    case 'business_ai_tokens':
      return go('BusinessAiTokens');
    case 'business_ai_cleanup':
      return go('BusinessItemsList');
    case 'business_location_hours':
      return go('BusinessLocationsList');
    case 'business_orders':
      return go('BusinessOrdersList');
    case 'business_items_rejected':
      return go('BusinessItemsList', { moderationStatus: 'rejected' });
    case 'business_item_edit':
      return go('BusinessItemsList');
    case 'business_share_store':
      if (businessId && routeNames.includes('StoreDetail')) {
        return go('StoreDetail', { businessId, previewMode: true });
      }
      resetToPersonaDashboard('business');
      return true;
    default:
      return false;
  }
}

function navigateWhenReady(
  type: string,
  businessId?: string | null,
  maxAttempts = 24
): void {
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    if (navigateEngagement(type, businessId)) return;
    if (attempts < maxAttempts) setTimeout(tryNavigate, 250);
    else pendingType = type;
  };
  tryNavigate();
}

function flushPending(canOpen: boolean, businessId?: string | null): void {
  if (!canOpen || !pendingType) return;
  const type = pendingType;
  pendingType = null;
  navigateWhenReady(type, businessId);
}

export function useNotificationOpenedMerchantEngagementNavigation(
  navReady: boolean
): void {
  const { auth, persona } = useStore();
  const { me } = useProfileMe();
  const handledInitialResponse = useRef(false);
  const businessIdRef = useRef<string | null>(null);
  businessIdRef.current = me?.business?.id ?? null;
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

    const openFromResponse = (data: Record<string, unknown> | undefined): void => {
      const type = parseType(data);
      if (!type) return;
      const businessId =
        (typeof data?.businessId === 'string' && data.businessId) ||
        businessIdRef.current;
      if (canOpenBusinessApp) {
        navigateWhenReady(type, businessId);
        return;
      }
      pendingType = type;
      if (canSwitchToBusiness) void persona.selectPersona('business');
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
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (parseType(data) === null) return;
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
    if (!navReady) return;
    flushPending(canOpenBusinessApp, businessIdRef.current);
  }, [navReady, canOpenBusinessApp, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        flushPending(canOpenBusinessApp, businessIdRef.current);
      }
    });
    return () => sub.remove();
  }, [canOpenBusinessApp]);
}
