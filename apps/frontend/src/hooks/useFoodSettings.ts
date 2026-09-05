import { useCallback, useState } from 'react';
import type { FoodAvailabilitySlot, FoodSettings } from '../types/food';
import { useApiClient } from './useApiClient';

interface FoodSettingsResponse {
  success: boolean;
  data: FoodSettings;
}

function basePath(itemId: string, locationId: string): string {
  return `/business-items/items/${itemId}/locations/${locationId}`;
}

function errorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error || err?.message || fallback;
}

/** Serving schedule and sold-out state for one dish at one location. */
export function useFoodSettings() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(
    async (itemId: string, locationId: string): Promise<FoodSettings | null> => {
      if (!apiClient) return null;
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<FoodSettingsResponse>(
          `${basePath(itemId, locationId)}/food-settings`
        );
        return res.data?.data ?? null;
      } catch (err: any) {
        setError(errorMessage(err, 'Failed to load serving schedule'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const saveSlots = useCallback(
    async (
      itemId: string,
      locationId: string,
      slots: FoodAvailabilitySlot[]
    ): Promise<FoodSettings> => {
      if (!apiClient) throw new Error('API client not available');
      setSaving(true);
      setError(null);
      try {
        const res = await apiClient.put<FoodSettingsResponse>(
          `${basePath(itemId, locationId)}/food-settings`,
          { slots }
        );
        return res.data.data;
      } catch (err: any) {
        const message = errorMessage(err, 'Failed to save serving schedule');
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [apiClient]
  );

  const setAvailableToday = useCallback(
    async (
      itemId: string,
      locationId: string,
      available: boolean
    ): Promise<FoodSettings> => {
      if (!apiClient) throw new Error('API client not available');
      setSaving(true);
      setError(null);
      try {
        const res = await apiClient.post<FoodSettingsResponse>(
          `${basePath(itemId, locationId)}/food-availability`,
          { available }
        );
        return res.data.data;
      } catch (err: any) {
        const message = errorMessage(err, 'Failed to update availability');
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [apiClient]
  );

  return {
    loading,
    saving,
    error,
    fetchSettings,
    saveSlots,
    setAvailableToday,
  };
}
