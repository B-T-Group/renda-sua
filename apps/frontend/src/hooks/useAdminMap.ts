import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { matchRegionName } from '../components/admin/map/matchMapRegion';
import {
  AdminMapPin,
  AdminMapQuery,
  AdminMapSearchHit,
  AdminMapSummary,
  EMPTY_MAP_SUMMARY,
  LIVE_POLL_MS,
} from '../components/admin/map/adminMap.types';
import { useMarket } from './useMarket';
import { useApiClient } from './useApiClient';

function pinParams(query: AdminMapQuery) {
  return {
    ...(query.country ? { country: query.country } : {}),
    ...(query.state ? { state: query.state } : {}),
    kind: query.kind,
  };
}

async function fetchPins(
  apiClient: ReturnType<typeof useApiClient>,
  query: AdminMapQuery
): Promise<{ pins: AdminMapPin[]; summary: AdminMapSummary }> {
  const { data } = await apiClient.get<{ pins: AdminMapPin[]; summary?: AdminMapSummary }>(
    '/admin/map/pins',
    { params: pinParams(query) }
  );
  return { pins: data.pins ?? [], summary: data.summary ?? EMPTY_MAP_SUMMARY };
}

export function useAdminMapPins(query: AdminMapQuery, live: boolean) {
  const apiClient = useApiClient();
  const requestSeq = useRef(0);
  const [pins, setPins] = useState<AdminMapPin[]>([]);
  const [summary, setSummary] = useState<AdminMapSummary>(EMPTY_MAP_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      const requestId = ++requestSeq.current;
      if (!silent) startVisibleLoad(setLoading, setPins, setSummary, setError);
      try {
        const next = await fetchPins(apiClient, query);
        if (requestId !== requestSeq.current) return;
        setPins(next.pins);
        setSummary(next.summary);
        setError(null);
      } catch (err: any) {
        if (requestId !== requestSeq.current) return;
        setError(err?.message || 'Failed to load map');
      } finally {
        if (!silent && requestId === requestSeq.current) setLoading(false);
      }
    },
    [apiClient, query.country, query.kind, query.state]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!live) return undefined;
    return startLivePoll(() => void load(true));
  }, [live, load]);

  return { pins, summary, loading, error };
}

export function useAdminMapRegions(country: string) {
  const apiClient = useApiClient();
  const [regions, setRegions] = useState<string[]>([]);

  useEffect(() => {
    if (!country) {
      setRegions([]);
      return undefined;
    }
    let cancelled = false;
    void loadRegions(apiClient, country).then((names) => {
      if (!cancelled) setRegions(names);
    });
    return () => {
      cancelled = true;
    };
  }, [apiClient, country]);

  return regions;
}

function startVisibleLoad(
  setLoading: (value: boolean) => void,
  setPins: (value: AdminMapPin[]) => void,
  setSummary: (value: AdminMapSummary) => void,
  setError: (value: string | null) => void
) {
  setLoading(true);
  setPins([]);
  setSummary(EMPTY_MAP_SUMMARY);
  setError(null);
}

function startLivePoll(refresh: () => void) {
  const id = window.setInterval(() => {
    if (document.visibilityState !== 'hidden') refresh();
  }, LIVE_POLL_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function useAdminMapSearch() {
  const apiClient = useApiClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminMapSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => watchSearch(apiClient, query, setResults, setLoading), [apiClient, query]);

  return { query, setQuery, results, loading };
}

export function useSeededMapMarket() {
  const { selectedMarket, hydrated } = useMarket();
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const regions = useAdminMapRegions(country);
  const seeded = useRef(false);
  const pendingState = useRef<string | null>(null);

  useEffect(() => {
    seedCountry(seeded, pendingState, selectedMarket, hydrated, setCountry);
  }, [hydrated, selectedMarket]);

  useEffect(() => {
    applyPendingRegion(pendingState, regions, setRegion);
  }, [regions]);

  const onCountry = (value: string) => {
    pendingState.current = null;
    setCountry(value);
    setRegion('');
  };
  return { country, region, regions, onCountry, onRegion: setRegion };
}

function seedCountry(
  seeded: MutableRefObject<boolean>,
  pending: MutableRefObject<string | null>,
  market: { countryCode: string; stateCode: string | null } | null,
  hydrated: boolean,
  setCountry: (value: string) => void
) {
  if (seeded.current || !hydrated || !market?.countryCode) return;
  seeded.current = true;
  pending.current = market.stateCode;
  setCountry(market.countryCode);
}

function applyPendingRegion(
  pending: MutableRefObject<string | null>,
  regions: string[],
  setRegion: (value: string) => void
) {
  const wanted = pending.current;
  if (!wanted || regions.length === 0) return;
  pending.current = null;
  const match = matchRegionName(regions, wanted);
  if (match) setRegion(match);
}

function watchSearch(
  apiClient: ReturnType<typeof useApiClient>,
  query: string,
  setResults: (value: AdminMapSearchHit[]) => void,
  setLoading: (value: boolean) => void
) {
  const term = query.trim();
  if (term.length < 2) {
    setResults([]);
    setLoading(false);
    return undefined;
  }
  return scheduleSearch(apiClient, term, setResults, setLoading);
}

function scheduleSearch(
  apiClient: ReturnType<typeof useApiClient>,
  term: string,
  setResults: (value: AdminMapSearchHit[]) => void,
  setLoading: (value: boolean) => void
) {
  let cancelled = false;
  setLoading(true);
  const timer = window.setTimeout(() => {
    void loadSearch(apiClient, term).then((hits) => {
      if (!cancelled) setResults(hits);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
  }, 300);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

async function loadSearch(
  apiClient: ReturnType<typeof useApiClient>,
  term: string
): Promise<AdminMapSearchHit[]> {
  try {
    const { data } = await apiClient.get<{ results: AdminMapSearchHit[] }>('/admin/map/search', {
      params: { q: term },
    });
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function loadRegions(
  apiClient: ReturnType<typeof useApiClient>,
  country: string
): Promise<string[]> {
  try {
    const { data } = await apiClient.get<{ regions: { stateName: string }[] }>(
      '/admin/map/regions',
      { params: { country } }
    );
    return (data.regions ?? []).map((row) => row.stateName);
  } catch {
    return [];
  }
}
