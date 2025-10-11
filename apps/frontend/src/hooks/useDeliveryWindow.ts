import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface DeliveryTimeWindow {
  id: string;
  order_id: string;
  slot_id: string;
  preferred_date: string;
  time_slot_start: string;
  time_slot_end: string;
  is_confirmed: boolean;
  special_instructions?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  created_at: string;
  updated_at: string;
  slot?: {
    id: string;
    slot_name: string;
    slot_type: 'standard' | 'fast';
    start_time: string;
    end_time: string;
  };
}

export interface CreateDeliveryWindowData {
  order_id: string;
  slot_id: string;
  preferred_date: string;
  special_instructions?: string;
}

export interface UpdateDeliveryWindowData {
  slot_id?: string;
  preferred_date?: string;
  special_instructions?: string;
}

export interface UseDeliveryWindowResult {
  deliveryWindow: DeliveryTimeWindow | null;
  loading: boolean;
  error: string | null;
  createDeliveryWindow: (
    data: CreateDeliveryWindowData
  ) => Promise<DeliveryTimeWindow | null>;
  updateDeliveryWindow: (
    orderId: string,
    data: UpdateDeliveryWindowData
  ) => Promise<DeliveryTimeWindow | null>;
  confirmDeliveryWindow: (
    orderId: string
  ) => Promise<DeliveryTimeWindow | null>;
  deleteDeliveryWindow: (orderId: string) => Promise<void>;
  refreshDeliveryWindow: () => Promise<void>;
}

export const useDeliveryWindow = (
  orderId?: string
): UseDeliveryWindowResult => {
  const apiClient = useApiClient();
  const [deliveryWindow, setDeliveryWindow] =
    useState<DeliveryTimeWindow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDeliveryWindow = useCallback(async () => {
    if (!orderId) {
      setDeliveryWindow(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/delivery-windows/order/${orderId}`
      );

      if (response.data.success) {
        setDeliveryWindow(response.data.deliveryWindow);
      } else {
        throw new Error(
          response.data.error || 'Failed to fetch delivery window'
        );
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        'Failed to fetch delivery window';
      setError(errorMessage);
      console.error('Failed to fetch delivery window:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId, apiClient]);

  const createDeliveryWindow = useCallback(
    async (
      data: CreateDeliveryWindowData
    ): Promise<DeliveryTimeWindow | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/delivery-windows', data);

        if (response.data.success) {
          const newDeliveryWindow = response.data.deliveryWindow;
          setDeliveryWindow(newDeliveryWindow);
          return newDeliveryWindow;
        } else {
          throw new Error(
            response.data.error || 'Failed to create delivery window'
          );
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ||
          (err as Error)?.message ||
          'Failed to create delivery window';
        setError(errorMessage);
        console.error('Failed to create delivery window:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const updateDeliveryWindow = useCallback(
    async (
      orderId: string,
      data: UpdateDeliveryWindowData
    ): Promise<DeliveryTimeWindow | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.patch(
          `/delivery-windows/${orderId}`,
          data
        );

        if (response.data.success) {
          const updatedDeliveryWindow = response.data.deliveryWindow;
          setDeliveryWindow(updatedDeliveryWindow);
          return updatedDeliveryWindow;
        } else {
          throw new Error(
            response.data.error || 'Failed to update delivery window'
          );
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ||
          (err as Error)?.message ||
          'Failed to update delivery window';
        setError(errorMessage);
        console.error('Failed to update delivery window:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const confirmDeliveryWindow = useCallback(
    async (orderId: string): Promise<DeliveryTimeWindow | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post(
          `/delivery-windows/${orderId}/confirm`
        );

        if (response.data.success) {
          const confirmedDeliveryWindow = response.data.deliveryWindow;
          setDeliveryWindow(confirmedDeliveryWindow);
          return confirmedDeliveryWindow;
        } else {
          throw new Error(
            response.data.error || 'Failed to confirm delivery window'
          );
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ||
          (err as Error)?.message ||
          'Failed to confirm delivery window';
        setError(errorMessage);
        console.error('Failed to confirm delivery window:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const deleteDeliveryWindow = useCallback(
    async (orderId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.delete(`/delivery-windows/${orderId}`);

        if (response.data.success) {
          setDeliveryWindow(null);
        } else {
          throw new Error(
            response.data.error || 'Failed to delete delivery window'
          );
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ||
          (err as Error)?.message ||
          'Failed to delete delivery window';
        setError(errorMessage);
        console.error('Failed to delete delivery window:', err);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  useEffect(() => {
    refreshDeliveryWindow();
  }, [refreshDeliveryWindow]);

  return {
    deliveryWindow,
    loading,
    error,
    createDeliveryWindow,
    updateDeliveryWindow,
    confirmDeliveryWindow,
    deleteDeliveryWindow,
    refreshDeliveryWindow,
  };
};
