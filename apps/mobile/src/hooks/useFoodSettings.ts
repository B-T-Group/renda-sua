import { useCallback, useState } from 'react';
import { businessApi } from '../services/businessApi';
import type { FoodAvailabilitySlot, FoodSettings } from '../types/food';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function unwrapSettings(res: { success: boolean; data: FoodSettings }): FoodSettings {
  if (!res.success || !res.data) {
    throw new Error('Failed to update food settings');
  }
  return res.data;
}

/** Serving schedule and sold-out state for one dish at one location. */
export function useFoodSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(
    async (itemId: string, locationId: string): Promise<FoodSettings | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await businessApi.catalog.getFoodSettings(itemId, locationId);
        return res.data ?? null;
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to load serving schedule'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const saveSlots = useCallback(
    async (
      itemId: string,
      locationId: string,
      slots: FoodAvailabilitySlot[]
    ): Promise<FoodSettings> => {
      setSaving(true);
      setError(null);
      try {
        const res = await businessApi.catalog.updateFoodSettings(
          itemId,
          locationId,
          slots
        );
        return unwrapSettings(res);
      } catch (err: unknown) {
        const message = errorMessage(err, 'Failed to save serving schedule');
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const setAvailableToday = useCallback(
    async (
      itemId: string,
      locationId: string,
      available: boolean
    ): Promise<FoodSettings> => {
      setSaving(true);
      setError(null);
      try {
        const res = await businessApi.catalog.setFoodAvailability(
          itemId,
          locationId,
          available
        );
        return unwrapSettings(res);
      } catch (err: unknown) {
        const message = errorMessage(err, 'Failed to update availability');
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    []
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
