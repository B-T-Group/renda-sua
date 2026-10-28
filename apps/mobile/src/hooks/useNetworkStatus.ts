/**
 * useNetworkStatus hook
 *
 * Provides network connectivity status using @react-native-community/netinfo,
 * accessed through the safe lazy wrapper (src/utils/safeNetInfo.ts) so a binary
 * without the netinfo native module assumes "online" instead of crashing the
 * OTA bundle at startup.
 * Returns isOffline boolean to disable mutations and show offline indicators.
 */

import { useEffect, useState } from 'react';
import { subscribeToNetInfo, type SafeNetInfoState } from '../utils/safeNetInfo';

export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToNetInfo((state: SafeNetInfoState) => {
      setIsOffline(!state.isConnected || !state.isInternetReachable);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOffline, isOnline: !isOffline };
}

export default useNetworkStatus;
