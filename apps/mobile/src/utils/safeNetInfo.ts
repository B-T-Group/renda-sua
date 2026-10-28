/**
 * Safe, lazy wrapper around `@react-native-community/netinfo`.
 *
 * netinfo was added after the 1.1.1 store binary was built (native module
 * `RNCNetInfo`). Importing the package at module top level throws in a binary
 * that lacks the native module, which crashes the OTA bundle at startup and
 * makes expo-updates fall back to the embedded bundle. This wrapper `require`s
 * the package lazily inside try/catch so a missing native module degrades to
 * "assume online, no listeners" instead of throwing.
 *
 * Never import `@react-native-community/netinfo` directly elsewhere in the app;
 * use this module (see apps/mobile/native-deps-baseline.json allowlist).
 */

export interface SafeNetInfoState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null | undefined;
}

export type NetInfoListener = (state: SafeNetInfoState) => void;
export type Unsubscribe = () => void;

interface NetInfoModule {
  addEventListener: (listener: NetInfoListener) => Unsubscribe | undefined;
}

const noop: Unsubscribe = () => {};

let cached: NetInfoModule | null | undefined;

function loadNetInfo(): NetInfoModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/netinfo');
    const candidate = mod && mod.default ? mod.default : mod;
    cached =
      candidate && typeof candidate.addEventListener === 'function'
        ? (candidate as NetInfoModule)
        : null;
  } catch {
    // Native module missing in this binary (or package failed to load).
    cached = null;
  }
  return cached;
}

/** True when the netinfo native module could be loaded in this binary. */
export function isNetInfoAvailable(): boolean {
  return loadNetInfo() !== null;
}

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function that is
 * always safe to call. When netinfo is unavailable this never throws, never
 * calls the listener, and returns a no-op (callers should assume online).
 */
export function subscribeToNetInfo(listener: NetInfoListener): Unsubscribe {
  const netInfo = loadNetInfo();
  if (!netInfo) return noop;
  try {
    const unsubscribe = netInfo.addEventListener(listener);
    return typeof unsubscribe === 'function' ? unsubscribe : noop;
  } catch {
    return noop;
  }
}

/** Test helper: forget the cached module resolution. */
export function __resetSafeNetInfoForTests(): void {
  cached = undefined;
}
