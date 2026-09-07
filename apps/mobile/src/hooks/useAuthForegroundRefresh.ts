import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useStore } from '../stores/RootStore';

/**
 * Silently refreshes the access token whenever the app returns to the
 * foreground, if it's expired or close to expiring. Without this, a token
 * that dies while the app is backgrounded only gets refreshed reactively —
 * on the next failed request — which can surface as a visible error before
 * the retry-after-refresh logic kicks in.
 */
export function useAuthForegroundRefresh(): void {
  const { auth } = useStore();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const cameToForeground =
        appStateRef.current.match(/inactive|background/) && next === 'active';
      appStateRef.current = next;

      if (cameToForeground && auth.isAuthenticated && !auth.isTokenValid) {
        void auth.refreshToken();
      }
    });

    return () => sub.remove();
  }, [auth]);
}
