/**
 * Regression: opening Dedicated agents (business persona) crashed the 1.1.1
 * store binary, which has no RNCNetInfo native module. On device Metro reports
 * a throwing module factory as a FATAL error when it is required lazily (e.g.
 * from useNetworkStatus' useEffect), so safeNetInfo's try/catch never helped.
 * The wrapper must not evaluate '@react-native-community/netinfo' at all when
 * the native module is absent.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { NativeModules, Text, TurboModuleRegistry } from 'react-native';

const mockNetInfoFactoryCalls = { count: 0 };
jest.mock('@react-native-community/netinfo', () => {
  mockNetInfoFactoryCalls.count += 1;
  throw new Error('Invariant Violation: TurboModuleRegistry.getEnforcing(...): RNCNetInfo could not be found.');
});

import {
  __resetSafeNetInfoForTests,
  hasNativeNetInfoModule,
  isNetInfoAvailable,
  subscribeToNetInfo,
} from '../../utils/safeNetInfo';
import { useNetworkStatus } from '../useNetworkStatus';

function Probe() {
  const { isOffline } = useNetworkStatus();
  return <Text>{isOffline ? 'offline' : 'online'}</Text>;
}

describe('netinfo native module absent (1.1.1 binary)', () => {
  let getSpy: jest.SpyInstance;
  const saved = (NativeModules as Record<string, unknown>).RNCNetInfo;

  beforeEach(() => {
    __resetSafeNetInfoForTests();
    mockNetInfoFactoryCalls.count = 0;
    getSpy = jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
    delete (NativeModules as Record<string, unknown>).RNCNetInfo;
  });

  afterEach(() => {
    getSpy.mockRestore();
    if (saved !== undefined) (NativeModules as Record<string, unknown>).RNCNetInfo = saved;
  });

  it('detects the missing native module without throwing', () => {
    expect(hasNativeNetInfoModule()).toBe(false);
    expect(isNetInfoAvailable()).toBe(false);
  });

  it('never evaluates the netinfo package (Metro would report it as fatal)', () => {
    const unsubscribe = subscribeToNetInfo(jest.fn());
    expect(() => unsubscribe()).not.toThrow();
    expect(mockNetInfoFactoryCalls.count).toBe(0);
  });

  it('a screen using useNetworkStatus mounts online and never loads netinfo', async () => {
    const screen = await render(<Probe />);
    expect(screen.getByText('online')).toBeTruthy();
    expect(mockNetInfoFactoryCalls.count).toBe(0);
  });
});
