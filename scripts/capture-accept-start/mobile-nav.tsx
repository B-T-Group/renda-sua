import React, { useEffect } from 'react';

export function NavigationContainer({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useRoute() {
  return {
    key: 'capture',
    name: 'capture',
    params: { bookingId: 'b1', stage: 'pickup' as const },
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
