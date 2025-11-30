import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface FailureReason {
  id: string;
  reason_key: string;
  reason: string;
  reason_en: string;
  reason_fr: string;
  is_active: boolean;
  sort_order: number;
}

export interface FailedDelivery {
  id: string;
  order_id: string;
  failure_reason_id: string;
  notes?: string;
  status: 'pending' | 'completed';
  resolution_type?: 'agent_fault' | 'client_fault' | 'item_fault';
  outcome?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  order: {
    id: string;
    order_number: string;
    current_status: string;
    total_amount: number;
    currency: string;
    business_id: string;
    created_at: string;
    client: {
      id: string;
      user: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
      };
    };
    business?: {
      id: string;
      user_id: string;
    };
    assigned_agent?: {
      id: string;
      user: {
        id: string;
        first_name: string;
        last_name: string;
      };
    };
    order_items?: Array<{
      id: string;
      business_inventory_id: string;
      quantity: number;
    }>;
    delivery_address?: {
      id: string;
      country: string;
    };
  };
  failure_reason: {
    id: string;
    reason_key: string;
    reason_en: string;
    reason_fr: string;
  };
}

export interface ResolutionRequest {
  resolution_type: 'agent_fault' | 'client_fault' | 'item_fault';
  outcome: string;
  restore_inventory?: boolean;
}

export interface GetFailedDeliveriesFilters {
  status?: 'pending' | 'completed';
  resolution_type?: 'agent_fault' | 'client_fault' | 'item_fault';
}

export const useFailedDeliveries = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const getFailureReasons = useCallback(
    async (language: 'en' | 'fr' = 'fr'): Promise<FailureReason[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          reasons: FailureReason[];
        }>(`/failed-deliveries/reasons?language=${language}`);

        if (response.data.success) {
          return response.data.reasons;
        }
        throw new Error('Failed to fetch failure reasons');
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to fetch failure reasons';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const getFailedDeliveries = useCallback(
    async (
      filters?: GetFailedDeliveriesFilters
    ): Promise<FailedDelivery[]> => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.status) {
          params.append('status', filters.status);
        }
        if (filters?.resolution_type) {
          params.append('resolution_type', filters.resolution_type);
        }

        const queryString = params.toString();
        const url = `/failed-deliveries${
          queryString ? `?${queryString}` : ''
        }`;

        const response = await apiClient.get<{
          success: boolean;
          failed_deliveries: FailedDelivery[];
        }>(url);

        if (response.data.success) {
          return response.data.failed_deliveries;
        }
        throw new Error('Failed to fetch failed deliveries');
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to fetch failed deliveries';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const getFailedDelivery = useCallback(
    async (orderId: string): Promise<FailedDelivery> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          failed_delivery: FailedDelivery;
        }>(`/failed-deliveries/${orderId}`);

        if (response.data.success) {
          return response.data.failed_delivery;
        }
        throw new Error('Failed to fetch failed delivery');
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to fetch failed delivery';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const resolveFailedDelivery = useCallback(
    async (
      orderId: string,
      resolution: ResolutionRequest
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{
          success: boolean;
          message: string;
        }>(`/failed-deliveries/${orderId}/resolve`, resolution);

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to resolve delivery');
        }
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to resolve failed delivery';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return {
    loading,
    error,
    getFailureReasons,
    getFailedDeliveries,
    getFailedDelivery,
    resolveFailedDelivery,
  };
};

