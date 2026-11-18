/** Capture stubs for mobile data and navigation. Not imported by the app. */
import { useEffect } from 'react';
import { dashboardPayload, listPayload } from './fixtures';

const flags = { rentals_dashboard_requests_enabled: true };

export function useClientFlags() {
  return { flags, loaded: true, loading: false, error: null };
}

export function ClientFlagsProvider({ children }: { children?: unknown }) {
  return children ?? null;
}

const getDashboardRequests = async () => dashboardPayload();
const getBusinessRequests = async () => listPayload();

export const rentalsApi = new Proxy(
  {},
  {
    get(_target, key) {
      if (key === 'getDashboardRequests') return getDashboardRequests;
      if (key === 'getBusinessRequests') return getBusinessRequests;
      if (typeof key === 'symbol') return undefined;
      return async () => [];
    },
  }
);

export const api = { post: async () => ({}), get: async () => ({}) };
export function trackSiteEvent() {
  return undefined;
}

export function useNavigation() {
  return {
    navigate() {
      return undefined;
    },
    setParams() {
      return undefined;
    },
    goBack() {
      return undefined;
    },
    getParent: () => ({ setOptions() { return undefined; } }),
  };
}

export function useRoute() {
  const scene = (globalThis as { __SCENE?: string }).__SCENE;
  return { name: 'BusinessRentalsStudio', params: { tab: scene === 'list' ? 'requests' : 'catalog' }, key: 'capture' };
}

export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(() => effect(), [effect]);
}

export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function SafeAreaProvider({ children }: { children?: unknown }) {
  if (typeof children === 'function') {
    return (children as (insets: { top: number; right: number; bottom: number; left: number }) => unknown)({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  }
  return children ?? null;
}

export function useMainTabContentBottomPadding() {
  return 24;
}

export function useTabBarGeometry() {
  return { tabBarOverlayHeight: 0, tabBarHeight: 0 };
}
