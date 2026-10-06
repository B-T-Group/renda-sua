import { useCallback, useEffect, useState } from 'react';
import { readBootstrapCountryCode } from '../utils/marketStorage';
import { useApiClient } from './useApiClient';

export type ClientFlagKey =
  | 'reels_enabled'
  | 'reels_comments_enabled'
  | 'reels_merchant_allowlist_only'
  | 'floating_nav_enabled'
  | 'reorder_v1'
  | 'auth_web_inapp_gates'
  | 'catalog_experience_v1'
  | 'assistant_launcher_v1'
  | 'assistant_shopping_v1';

export type ClientFlags = Record<ClientFlagKey, boolean>;

const DEFAULT_FLAGS: ClientFlags = {
  reels_enabled: false,
  reels_comments_enabled: false,
  reels_merchant_allowlist_only: false,
  floating_nav_enabled: false,
  reorder_v1: false,
  auth_web_inapp_gates: false,
  catalog_experience_v1: false,
  assistant_launcher_v1: false,
  assistant_shopping_v1: false,
};

/**
 * Every consumer shares one request per country (there are several on most pages:
 * app shell, auth gate, funnel tracking, items …). A response is reused for this
 * long, so a remount reads it synchronously instead of refetching.
 */
export const CLIENT_FLAGS_CACHE_TTL_MS = 60_000;
/**
 * `loaded` turns true after this long even when the request hasn't settled, so UI
 * that waits for flags (the D2 WhatsApp swap, the header assistant slot) falls back
 * to the defaults instead of waiting for the 30 s axios timeout.
 */
export const CLIENT_FLAGS_WAIT_MS = 3000;

const resolvedFlags = new Map<string, { at: number; flags: ClientFlags }>();
const inflightFlags = new Map<string, Promise<ClientFlags>>();

function clientFlagsPath(): string {
  const country = readBootstrapCountryCode();
  return country
    ? `/app-config/client-flags?country=${encodeURIComponent(country)}`
    : '/app-config/client-flags';
}

function cachedClientFlags(path: string): ClientFlags | null {
  const hit = resolvedFlags.get(path);
  if (!hit || Date.now() - hit.at > CLIENT_FLAGS_CACHE_TTL_MS) return null;
  return hit.flags;
}

function fetchClientFlags(
  apiClient: ReturnType<typeof useApiClient>,
  path: string
): Promise<ClientFlags> {
  const pending = inflightFlags.get(path);
  if (pending) return pending;
  const request = apiClient
    .get<{ success: boolean; data: ClientFlags }>(path)
    .then((res) => {
      const flags = { ...DEFAULT_FLAGS, ...(res.data?.data ?? {}) };
      resolvedFlags.set(path, { at: Date.now(), flags });
      return flags;
    })
    .finally(() => {
      inflightFlags.delete(path);
    });
  inflightFlags.set(path, request);
  return request;
}

/** Test helper: forget cached and in-flight flag responses. */
export function __resetClientFlagsCache(): void {
  resolvedFlags.clear();
  inflightFlags.clear();
}

type FlagsState = { flags: ClientFlags; settled: boolean };

export function useClientFlags() {
  const apiClient = useApiClient();
  const [state, setState] = useState<FlagsState>(() => {
    const cached = cachedClientFlags(clientFlagsPath());
    return cached
      ? { flags: cached, settled: true }
      : { flags: DEFAULT_FLAGS, settled: false };
  });
  const [waitExpired, setWaitExpired] = useState(false);

  useEffect(() => {
    if (!apiClient) return;
    let cancelled = false;
    const path = clientFlagsPath();
    const apply = (flags: ClientFlags) => {
      if (cancelled) return;
      setState((prev) =>
        prev.settled && prev.flags === flags ? prev : { flags, settled: true }
      );
    };
    const cached = cachedClientFlags(path);
    if (cached) {
      apply(cached);
    } else {
      // A failure keeps the defaults (and is not cached, so the next mount retries).
      fetchClientFlags(apiClient, path).then(apply, () => apply(DEFAULT_FLAGS));
    }
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  useEffect(() => {
    if (state.settled) return undefined;
    const timer = setTimeout(() => setWaitExpired(true), CLIENT_FLAGS_WAIT_MS);
    return () => clearTimeout(timer);
  }, [state.settled]);

  return {
    flags: state.flags,
    /**
     * True once the flags call settled (failure keeps the defaults) or the
     * `CLIENT_FLAGS_WAIT_MS` budget ran out; a late response still updates `flags`.
     */
    loaded: state.settled || waitExpired,
  };
}

export function useReorderOrder() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);

  const reorder = useCallback(
    async (orderId: string) => {
      if (!apiClient) throw new Error('API client unavailable');
      setLoading(true);
      try {
        const res = await apiClient.post(`/orders/${orderId}/reorder`);
        return res.data;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { reorder, loading };
}
