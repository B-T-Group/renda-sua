/**
 * useNetworkStatus hook
 *
 * Provides network connectivity status using @react-native-community/netinfo.
 * Returns isOffline boolean to disable mutations and show offline indicators.
 */

import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOffline(!state.isConnected || !state.isInternetReachable);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOffline, isOnline: !isOffline };
}

export default useNetworkStatus;
