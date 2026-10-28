/**
 * Simulates a store binary WITHOUT the netinfo native module (e.g. the 1.1.1
 * build): requiring '@react-native-community/netinfo' throws, exactly like the
 * real package does when `NativeModules.RNCNetInfo` is null. The app must keep
 * working and assume "online" rather than crash the OTA bundle at startup.
 */

import { renderHook } from '@testing-library/react-native';

jest.mock('@react-native-community/netinfo', () => {
  throw new Error(
    '@react-native-community/netinfo: NativeModule: RNCNetInfo is null.'
  );
});

import {
  __resetSafeNetInfoForTests,
  isNetInfoAvailable,
  subscribeToNetInfo,
} from '../../utils/safeNetInfo';
import { useNetworkStatus } from '../useNetworkStatus';

describe('netinfo native module missing', () => {
  beforeEach(() => {
    __resetSafeNetInfoForTests();
  });

  it('importing the hook and wrapper does not throw', async () => {
    expect(typeof useNetworkStatus).toBe('function');
    expect(typeof subscribeToNetInfo).toBe('function');
  });

  it('reports netinfo as unavailable', async () => {
    expect(isNetInfoAvailable()).toBe(false);
  });

  it('subscribeToNetInfo returns a no-op unsubscribe and never calls the listener', async () => {
    const listener = jest.fn();
    let unsubscribe: () => void = () => undefined;
    expect(() => {
      unsubscribe = subscribeToNetInfo(listener);
    }).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('useNetworkStatus falls back to online without throwing', async () => {
    const { result, unmount } = await renderHook(() => useNetworkStatus());
    expect(result.current).toEqual({ isOffline: false, isOnline: true });
    await expect(Promise.resolve(unmount())).resolves.not.toThrow();
  });
});
