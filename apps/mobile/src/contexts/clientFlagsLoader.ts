import { reaction } from 'mobx';
import {
  DEFAULT_CLIENT_FLAGS,
  type ClientFlags,
  type ClientFlagsFetchResult,
} from '../services/clientFlagsApi';

export type ClientFlagsLoaderState = { flags: ClientFlags; loading: boolean };

export type ClientFlagsFetcher = (country?: string) => Promise<ClientFlagsFetchResult>;

export interface ClientFlagsLoader {
  /** Re-fetch for the current market. Resolves once this request settles. */
  refresh: () => Promise<void>;
  /** Point the loader at a market; fetches on the first call and on every change. */
  setCountry: (countryCode: string | undefined) => Promise<void>;
  getState: () => ClientFlagsLoaderState;
  /** Stop emitting; late responses are ignored. */
  dispose: () => void;
}

/** Same values → same object, so consumers don't re-render on an identical refetch. */
export function mergeClientFlags(prev: ClientFlags, next: ClientFlags): ClientFlags {
  const keys = Object.keys(next) as (keyof ClientFlags)[];
  const same =
    keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k]);
  return same ? prev : next;
}

/**
 * Plain (React-free) client flags loader used by ClientFlagsProvider.
 * - Latest request wins; out-of-order responses are ignored.
 * - A failed fetch keeps the last known flags. Before any success those are
 *   `initialFlags` (all-false defaults), so a first-ever failure behaves as before.
 */
export function createClientFlagsLoader(
  fetcher: ClientFlagsFetcher,
  onChange: (state: ClientFlagsLoaderState) => void,
  initialFlags: ClientFlags = DEFAULT_CLIENT_FLAGS
): ClientFlagsLoader {
  let state: ClientFlagsLoaderState = { flags: initialFlags, loading: true };
  let country: string | undefined;
  let hasCountry = false;
  let requestId = 0;
  let disposed = false;

  const emit = (next: ClientFlagsLoaderState) => {
    if (next.flags === state.flags && next.loading === state.loading) return;
    state = next;
    if (!disposed) onChange(state);
  };

  const refresh = async () => {
    if (disposed) return;
    const id = ++requestId;
    emit({ flags: state.flags, loading: true });
    let result: ClientFlagsFetchResult;
    try {
      result = await fetcher(country);
    } catch (error) {
      result = { ok: false, error };
    }
    if (disposed || id !== requestId) return;
    if (result.ok) {
      emit({ flags: mergeClientFlags(state.flags, result.flags), loading: false });
    } else {
      console.warn('Client flags fetch failed; keeping last known flags', result.error);
      emit({ flags: state.flags, loading: false });
    }
  };

  const setCountry = (countryCode: string | undefined) => {
    if (hasCountry && countryCode === country) return Promise.resolve();
    hasCountry = true;
    country = countryCode;
    return refresh();
  };

  return {
    refresh,
    setCountry,
    getState: () => state,
    dispose: () => {
      disposed = true;
    },
  };
}

/** The slice of MarketStore the flags loader depends on. */
export type MarketCountrySource = { hydrated: boolean; selectedCountryCode: string | null | undefined };

/** Market country for the flags request: ISO-2 once hydrated, otherwise none (global flags). */
export function marketCountryForFlags(market: MarketCountrySource): string | undefined {
  if (!market.hydrated) return undefined;
  const code = market.selectedCountryCode;
  return typeof code === 'string' && code.length > 0 ? code.toUpperCase() : undefined;
}

/**
 * Calls `onCountry` now and whenever the observable market country changes
 * (manual switch or AUTO re-detection). Returns a disposer.
 */
export function watchMarketCountry(
  market: MarketCountrySource,
  onCountry: (countryCode: string | undefined) => void
): () => void {
  return reaction(() => marketCountryForFlags(market), onCountry, { fireImmediately: true });
}
