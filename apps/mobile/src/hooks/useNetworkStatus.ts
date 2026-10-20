import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // For now, assume always online
    // TODO: Implement actual network detection using expo-network or @react-native-community/netinfo
    setIsOnline(true);
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
