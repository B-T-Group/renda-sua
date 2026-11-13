import React, { useEffect } from 'react';

export function NavigationContainer({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useRoute() {
  const params = new URLSearchParams(window.location.search);
  const segment = params.get('segment');
  return {
    key: 'capture',
    name: 'capture',
    params: {
      bookingId: 'b1',
      stage: 'pickup' as const,
      segment: segment === 'upcoming' || segment === 'past' || segment === 'action_needed' ? segment : undefined,
    },
  };
}

export function useNavigation() {
  return {
    navigate() {
      return undefined;
    },
    goBack() {
      return undefined;
    },
    setOptions() {
      return undefined;
    },
    addListener() {
      return () => undefined;
    },
    canGoBack() {
      return false;
    },
  };
}

export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(() => effect(), [effect]);
}
