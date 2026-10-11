import { useState, useCallback, useEffect } from 'react';
import {
  checkRestockAlertsEnabled,
  getRestockPreferences,
  patchRestockPreferences,
  setItemAlert,
  type RestockPreferences,
} from '../services/restockAlertsApi';

export interface UseRestockAlertsResult {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  preferences: RestockPreferences | null;
  prefsLoading: boolean;
  prefsSaving: boolean;
  prefsError: string | null;
  checkEnabled: () => Promise<boolean>;
  loadPreferences: () => Promise<void>;
  updatePreferences: (patch: Partial<RestockPreferences>) => Promise<void>;
  toggleItemAlert: (itemId: string, enabled: boolean) => Promise<void>;
}

export function useRestockAlerts(): UseRestockAlertsResult {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<RestockPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const checkEnabled = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const isEnabled = await checkRestockAlertsEnabled();
      setEnabled(isEnabled);
      return isEnabled;
    } catch (e: any) {
      const msg = e?.message || 'Failed to check restock alerts status';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      setPrefsLoading(true);
      setPrefsError(null);
      const prefs = await getRestockPreferences();
      setPreferences(prefs);
    } catch (e: any) {
      const msg = e?.message || 'Failed to load restock preferences';
      setPrefsError(msg);
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (patch: Partial<RestockPreferences>) => {
      try {
        setPrefsSaving(true);
        setPrefsError(null);
        const updated = await patchRestockPreferences(patch);
        setPreferences(updated);
      } catch (e: any) {
        const msg = e?.message || 'Failed to update restock preferences';
        setPrefsError(msg);
        throw e;
      } finally {
        setPrefsSaving(false);
      }
    },
    []
  );

  const toggleItemAlert = useCallback(async (itemId: string, enabled: boolean) => {
    try {
      await setItemAlert(itemId, enabled);
    } catch (e: any) {
      throw e;
    }
  }, []);

  useEffect(() => {
    void checkEnabled();
  }, [checkEnabled]);

  return {
    enabled,
    loading,
    error,
    preferences,
    prefsLoading,
    prefsSaving,
    prefsError,
    checkEnabled,
    loadPreferences,
    updatePreferences,
    toggleItemAlert,
  };
}
