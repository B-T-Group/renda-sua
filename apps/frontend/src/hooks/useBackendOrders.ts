import { useState } from 'react';
import { useApiClient } from './useApiClient';
import { useApiWithLoading } from './useApiWithLoading';

export interface OrderItem {
  business_inventory_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  item: OrderItem;
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

export interface UpdateOrderStatusRequest {
  status: string;
}

export interface UpdateOrderStatusResponse {
  success: boolean;
  order: any;
  message: string;
}

export const useBackendOrders = () => {
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();
  const { callWithLoading } = useApiWithLoading({
    loadingMessage: 'common.updatingOrder',
  });

  const createOrder = async (
    orderData: CreateOrderRequest
  ): Promise<OrderResult> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<CreateOrderResponse>(
          '/orders',
          orderData
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to create order');
        }

        return response.data.order;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to create order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'common.savingData');
  };

  const updateOrderStatus = async (
    orderId: string,
    status: string
  ): Promise<any> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.patch<UpdateOrderStatusResponse>(
          `/orders/${orderId}/status`,
          { status }
        );

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Failed to update order status'
          );
        }

        return response.data.order;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to update order status';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  return {
    createOrder,
    updateOrderStatus,
    loading: false, // Loading is now handled globally
    error,
  };
};
