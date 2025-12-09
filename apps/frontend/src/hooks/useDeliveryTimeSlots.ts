import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface DeliveryTimeSlot {
  id: string;
  slot_name: string;
  slot_type: 'standard' | 'fast';
  start_time: string;
  end_time: string;
  available_capacity: number;
  is_available: boolean;
}

export interface UseDeliveryTimeSlotsResult {
  slots: DeliveryTimeSlot[];
  loading: boolean;
  error: string | null;
  fetchSlots: (
    countryCode: string,
    stateCode: string,
    date: string,
    isFastDelivery?: boolean
  ) => Promise<void>;
}

export const useDeliveryTimeSlots = (): UseDeliveryTimeSlotsResult => {
  const apiClient = useApiClient();
  const [slots, setSlots] = useState<DeliveryTimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(
    async (
      countryCode: string,
      stateCode: string,
      date: string,
      isFastDelivery?: boolean
    ) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          countryCode,
          stateCode,
          date,
          ...(isFastDelivery !== undefined && {
            isFastDelivery: isFastDelivery.toString(),
          }),
        });

        const response = await apiClient.get(
          `/delivery-windows/slots?${params}`
        );

        if (response.data.success) {
          setSlots(response.data.slots);
        } else {
          throw new Error(
            response.data.error || 'Failed to fetch delivery slots'
          );
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ||
          (err as Error)?.message ||
          'Failed to fetch delivery time slots';
        setError(errorMessage);
        setSlots([]);
        console.error('Failed to fetch delivery slots:', err);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return {
    slots,
    loading,
    error,
    fetchSlots,
  };
};
