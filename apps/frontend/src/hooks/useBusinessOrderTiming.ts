import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface BusinessOrderTiming {
  acceptance_timeout_seconds: number | null;
  future_acceptance_timeout_seconds: number | null;
  order_activation_lead_minutes: number | null;
  default_estimated_prep_minutes: number | null;
  effective: {
    acceptance_timeout_seconds: number;
    future_acceptance_timeout_seconds: number;
    order_activation_lead_minutes: number;
    default_estimated_prep_minutes: number;
  };
  defaults: {
    acceptance_timeout_seconds: number;
    future_acceptance_timeout_seconds: number;
    order_activation_lead_minutes: number;
    default_estimated_prep_minutes: number;
  };
  activation_lead_choices: number[];
}

export function useBusinessOrderTiming() {
  const apiClient = useApiClient();
  const [timing, setTiming] = useState<BusinessOrderTiming | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTiming = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<BusinessOrderTiming>(
        '/business/order-timing'
      );
      setTiming(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load order timing');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void fetchTiming();
  }, [fetchTiming]);

  const updateTiming = useCallback(
    async (body: {
      acceptance_timeout_seconds?: number | null;
      future_acceptance_timeout_seconds?: number | null;
      order_activation_lead_minutes?: number | null;
      default_estimated_prep_minutes?: number | null;
    }) => {
      if (!apiClient) throw new Error('API client not available');
      setSaving(true);
      setError(null);
      try {
        const res = await apiClient.put<BusinessOrderTiming & { success: boolean }>(
          '/business/order-timing',
          body
        );
        setTiming(res.data);
        return res.data;
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to update order timing';
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [apiClient]
  );

  return { timing, loading, saving, error, fetchTiming, updateTiming };
}
