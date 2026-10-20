import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) {
          setIsOnline(state.isConnected ?? true);
        }
      } catch {
        if (mounted) {
          setIsOnline(true);
        }
      }
    };

    checkNetwork();

    // Poll network status every 5 seconds
    const interval = setInterval(checkNetwork, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
