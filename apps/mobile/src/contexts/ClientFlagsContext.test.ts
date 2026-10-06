import { describe, it, expect, beforeEach, vi } from 'vitest';
import { observable, runInAction } from 'mobx';
import {
  DEFAULT_CLIENT_FLAGS,
  fetchClientFlags,
  type ClientFlags,
  type ClientFlagsFetchResult,
} from '../services/clientFlagsApi';
import {
  createClientFlagsLoader,
  marketCountryForFlags,
  mergeClientFlags,
  watchMarketCountry,
  type ClientFlagsLoaderState,
} from './clientFlagsLoader';

const { publicApiGet } = vi.hoisted(() => ({ publicApiGet: vi.fn() }));
vi.mock('../services/publicApiClient', () => ({ publicApiGet }));

const PROD_LIKE: ClientFlags = {
  ...DEFAULT_CLIENT_FLAGS,
  catalog_experience_v1: true,
  floating_nav_enabled: true,
  reels_enabled: true,
  reorder_v1: true,
};
const ok = (flags: ClientFlags): ClientFlagsFetchResult => ({ ok: true, flags });
const fail = (): ClientFlagsFetchResult => ({ ok: false, error: new Error('Network request failed') });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Wires the loader to an observable market exactly like ClientFlagsProvider does. */
function wire(fetcher: (c?: string) => Promise<ClientFlagsFetchResult>, countryCode = 'CM') {
  const market = observable({ hydrated: true, selectedCountryCode: countryCode });
  const states: ClientFlagsLoaderState[] = [];
  const loader = createClientFlagsLoader(fetcher, (s) => states.push(s));
  const stop = watchMarketCountry(market, (code) => {
    void loader.setCountry(code);
  });
  return { market, loader, states, stop };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  publicApiGet.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('fetchClientFlags', () => {
  it('passes the country and merges over defaults on success', async () => {
    publicApiGet.mockResolvedValue({ success: true, data: { reels_enabled: true }, message: '' });
    const res = await fetchClientFlags('CM');
    expect(publicApiGet).toHaveBeenCalledWith('/app-config/client-flags', { country: 'CM' }, undefined);
    expect(res).toEqual({ ok: true, flags: { ...DEFAULT_CLIENT_FLAGS, reels_enabled: true } });
  });

  it('omits the country param when no market is known', async () => {
    publicApiGet.mockResolvedValue({ success: true, data: {}, message: '' });
    await fetchClientFlags(undefined);
    expect(publicApiGet).toHaveBeenCalledWith('/app-config/client-flags', undefined, undefined);
  });

  it('reports failure instead of returning all-false defaults', async () => {
    publicApiGet.mockRejectedValue(new Error('Network request failed'));
    expect((await fetchClientFlags('CM')).ok).toBe(false);
    publicApiGet.mockResolvedValue(undefined); // empty body
    expect((await fetchClientFlags('CM')).ok).toBe(false);
  });
});

describe('marketCountryForFlags', () => {
  it('uses the ISO-2 code only once the market store is hydrated', () => {
    expect(marketCountryForFlags({ hydrated: false, selectedCountryCode: 'CM' })).toBeUndefined();
    expect(marketCountryForFlags({ hydrated: true, selectedCountryCode: 'ga' })).toBe('GA');
    expect(marketCountryForFlags({ hydrated: true, selectedCountryCode: '' })).toBeUndefined();
    expect(marketCountryForFlags({ hydrated: true, selectedCountryCode: null })).toBeUndefined();
  });
});

describe('client flags loader (ClientFlagsProvider logic)', () => {
  it('fetches once on cold start with the market country', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(PROD_LIKE));
    const { loader } = wire(fetcher);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('CM');
    expect(loader.getState()).toEqual({ flags: PROD_LIKE, loading: false });
  });

  it('refetches with the new country when the market changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(PROD_LIKE));
    const { market } = wire(fetcher);
    await flush();
    runInAction(() => {
      market.selectedCountryCode = 'GA';
    });
    await flush();
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(['CM', 'GA']);
  });

  it('does not refetch when the market is set to the same country', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(PROD_LIKE));
    const { market } = wire(fetcher);
    await flush();
    runInAction(() => {
      market.selectedCountryCode = 'CM';
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps the last known flags when a refetch fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(PROD_LIKE)).mockResolvedValueOnce(fail());
    const { loader } = wire(fetcher);
    await flush();
    await loader.refresh();
    expect(loader.getState()).toEqual({ flags: PROD_LIKE, loading: false });
  });

  it('keeps the last known flags when a market-change refetch fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(PROD_LIKE)).mockResolvedValueOnce(fail());
    const { market, loader } = wire(fetcher);
    await flush();
    runInAction(() => {
      market.selectedCountryCode = 'GA';
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(loader.getState().flags).toBe(PROD_LIKE);
  });

  it('treats a throwing fetcher as a failure and keeps flags', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(PROD_LIKE)).mockRejectedValueOnce(new Error('boom'));
    const { loader } = wire(fetcher);
    await flush();
    await loader.refresh();
    expect(loader.getState().flags).toBe(PROD_LIKE);
  });

  it('uses all-false defaults on a first-ever failure (cold start as before)', async () => {
    const fetcher = vi.fn().mockResolvedValue(fail());
    const { loader } = wire(fetcher);
    await flush();
    expect(loader.getState()).toEqual({ flags: DEFAULT_CLIENT_FLAGS, loading: false });
  });

  it('ignores out-of-order responses (latest request wins)', async () => {
    const a = deferred<ClientFlagsFetchResult>();
    const b = deferred<ClientFlagsFetchResult>();
    const fetcher = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { market, loader } = wire(fetcher);
    runInAction(() => {
      market.selectedCountryCode = 'GA';
    });
    b.resolve(ok({ ...PROD_LIKE, assistant_launcher_v1: true }));
    await flush();
    a.resolve(ok({ ...PROD_LIKE, assistant_launcher_v1: false }));
    await flush();
    expect(loader.getState().flags.assistant_launcher_v1).toBe(true);
    expect(loader.getState().loading).toBe(false);
  });

  it('keeps the same flags object when a refetch returns identical values', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(PROD_LIKE)).mockResolvedValueOnce(ok({ ...PROD_LIKE }));
    const { loader, states } = wire(fetcher);
    await flush();
    await loader.refresh();
    expect(loader.getState().flags).toBe(PROD_LIKE);
    expect(mergeClientFlags(PROD_LIKE, { ...PROD_LIKE, reels_enabled: false })).not.toBe(PROD_LIKE);
    expect(states.every((s) => s.flags === DEFAULT_CLIENT_FLAGS || s.flags === PROD_LIKE)).toBe(true);
  });

  it('stops emitting and reacting after dispose', async () => {
    const d = deferred<ClientFlagsFetchResult>();
    const fetcher = vi.fn().mockReturnValueOnce(d.promise);
    const { market, loader, states, stop } = wire(fetcher);
    stop();
    loader.dispose();
    d.resolve(ok(PROD_LIKE));
    await flush();
    runInAction(() => {
      market.selectedCountryCode = 'GA';
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(states.some((s) => s.flags === PROD_LIKE)).toBe(false);
  });
});
