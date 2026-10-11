import { useCallback, useEffect, useState } from 'react';
import {
  getRestockPreferences,
  patchRestockPreferences,
  type RestockPreferences,
  type RestockPreferencesPatch,
} from '../services/restockAlertsApi';

/** Settings > Notifications > Restock alerts. Only fetches when `enabled`. */
export function useRestockPreferences(enabled: boolean) {
  const [preferences, setPreferences] = useState<RestockPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreferences(await getRestockPreferences());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load restock preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const update = useCallback(async (patch: RestockPreferencesPatch) => {
    setSaving(true);
    setError(null);
    try {
      setPreferences(await patchRestockPreferences(patch));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update restock preferences');
    } finally {
      setSaving(false);
    }
  }, []);

  return { preferences, loading, saving, error, reload: load, update };
}
