import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { DeliveryTimeSlot } from './useDeliveryTimeSlots';

export interface UseNextAvailableDaySlotsResult {
  date: string | null;
  slots: DeliveryTimeSlot[];
  loading: boolean;
  error: string | null;
  fetchNextDay: () => Promise<void>;
}

export const useNextAvailableDaySlots = (
  countryCode?: string,
  stateCode?: string,
  isFastDelivery?: boolean
): UseNextAvailableDaySlotsResult => {
  const apiClient = useApiClient();
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<DeliveryTimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNextDay = useCallback(async () => {
    if (!countryCode || !stateCode) {
      setDate(null);
      setSlots([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        countryCode,
        stateCode,
        ...(isFastDelivery !== undefined && {
          isFastDelivery: isFastDelivery.toString(),
        }),
      });

      const response = await apiClient.get(
        `/delivery-windows/next-available-day?${params}`
      );

      if (response.data.success && response.data.date && response.data.slots) {
        setDate(response.data.date);
        setSlots(response.data.slots);
      } else {
        setDate(null);
        setSlots([]);
        if (!response.data.success) {
          throw new Error(response.data.message || 'No available slots found');
        }
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        'Failed to fetch next available day';
      setError(errorMessage);
      setDate(null);
      setSlots([]);
      console.error('Failed to fetch next available day:', err);
    } finally {
      setLoading(false);
    }
  }, [countryCode, stateCode, isFastDelivery, apiClient]);

  return {
    date,
    slots,
    loading,
    error,
    fetchNextDay,
  };
};

