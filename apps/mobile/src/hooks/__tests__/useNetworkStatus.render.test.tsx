/**
 * Behaviour with the netinfo native module present must be unchanged by the
 * safe lazy wrapper: listener updates drive isOffline and unmount unsubscribes.
 */

import { act, renderHook } from '@testing-library/react-native';

const mockUnsubscribe = jest.fn();
const mockAddEventListener = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

import { __resetSafeNetInfoForTests } from '../../utils/safeNetInfo';
import { useNetworkStatus } from '../useNetworkStatus';

type Listener = (s: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) => void;

describe('netinfo native module present', () => {
  let listener: Listener;

  beforeEach(() => {
    __resetSafeNetInfoForTests();
    mockUnsubscribe.mockReset();
    mockAddEventListener.mockReset();
    mockAddEventListener.mockImplementation((l: Listener) => {
      listener = l;
      return mockUnsubscribe;
    });
  });

  it('starts online and subscribes once', async () => {
    const { result } = await renderHook(() => useNetworkStatus());
    expect(result.current).toEqual({ isOffline: false, isOnline: true });
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });

  it('goes offline when disconnected or internet unreachable, then back online', async () => {
    const { result } = await renderHook(() => useNetworkStatus());

    await act(async () => listener({ isConnected: false, isInternetReachable: false }));
    expect(result.current.isOffline).toBe(true);
    expect(result.current.isOnline).toBe(false);

    await act(async () => listener({ isConnected: true, isInternetReachable: true }));
    expect(result.current.isOffline).toBe(false);

    await act(async () => listener({ isConnected: true, isInternetReachable: false }));
    expect(result.current.isOffline).toBe(true);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = await renderHook(() => useNetworkStatus());
    await unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not throw if addEventListener itself throws', async () => {
    mockAddEventListener.mockImplementation(() => {
      throw new Error('boom');
    });
    const { result, unmount } = await renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(false);
    await expect(Promise.resolve(unmount())).resolves.not.toThrow();
  });

  it('treats a non-function unsubscribe as a no-op so unmount does not throw', async () => {
    mockAddEventListener.mockImplementation((l: Listener) => {
      listener = l;
      return undefined;
    });
    const { unmount } = await renderHook(() => useNetworkStatus());
    await expect(Promise.resolve(unmount())).resolves.not.toThrow();
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });
});
