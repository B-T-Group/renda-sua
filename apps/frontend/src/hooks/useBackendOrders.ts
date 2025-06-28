import { useState } from 'react';
import { useApiClient } from './useApiClient';

export interface OrderItem {
  item_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: OrderItem[];
}

export interface OrderResult {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  order_items: any[];
}

export interface CreateOrderResponse {
  success: boolean;
  order: OrderResult;
  message: string;
}

export const useBackendOrders = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const createOrder = async (orderData: CreateOrderRequest): Promise<OrderResult> => {
    if (!apiClient) {
      throw new Error('API client not available. Please ensure you are authenticated.');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<CreateOrderResponse>('/orders', orderData);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create order');
      }

      return response.data.order;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create order';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    createOrder,
    loading,
    error,
  };
}; 