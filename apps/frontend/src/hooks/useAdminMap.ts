import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdminMapPin,
  AdminMapQuery,
  LIVE_POLL_MS,
} from '../components/admin/map/adminMap.types';
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
): Promise<AdminMapPin[]> {
  const { data } = await apiClient.get<{ pins: AdminMapPin[] }>('/admin/map/pins', {
    params: pinParams(query),
  });
  return data.pins ?? [];
}

export function useAdminMapPins(query: AdminMapQuery, live: boolean) {
  const apiClient = useApiClient();
  const requestSeq = useRef(0);
  const [pins, setPins] = useState<AdminMapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      const requestId = ++requestSeq.current;
      if (!silent) startVisibleLoad(setLoading, setPins, setError);
      try {
        const next = await fetchPins(apiClient, query);
        if (requestId !== requestSeq.current) return;
        setPins(next);
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

  return { pins, loading, error };
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
  setError: (value: string | null) => void
) {
  setLoading(true);
  setPins([]);
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
