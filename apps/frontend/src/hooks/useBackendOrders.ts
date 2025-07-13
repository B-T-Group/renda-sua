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

// New interfaces for order management APIs
export interface OrderStatusChangeRequest {
  orderId: string;
  notes?: string;
}

export interface GetOrderRequest {
  orderId: string;
}

export interface OrderStatusChangeResponse {
  success: boolean;
  order: any;
  message: string;
  holdAmount?: number; // For agent operations
}

export interface OrderDetails {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  business_location_id: string;
  assigned_agent_id?: string;
  delivery_address_id: string;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  current_status: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  special_instructions?: string;
  preferred_delivery_time?: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  updated_at: string;
  client?: any;
  business?: any;
  business_location?: any;
  delivery_address?: any;
  assigned_agent?: any;
  order_items?: any[];
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

  // Business Order Management APIs
  const confirmOrder = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/confirm',
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to confirm order');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to confirm order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.confirming');
  };

  const startPreparing = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/start_preparing',
          request
        );

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Failed to start preparing order'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to start preparing order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.startingPreparation');
  };

  const completePreparation = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/complete_preparation',
          request
        );

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Failed to complete order preparation'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to complete order preparation';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.completingPreparation');
  };

  const cancelOrder = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/cancel',
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to cancel order');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to cancel order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.cancelling');
  };

  const refundOrder = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/refund',
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to refund order');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to refund order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.refunding');
  };

  // Agent Order Management APIs
  const getOrder = async (
    request: GetOrderRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/get_order',
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to get order');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to get order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.gettingOrder');
  };

  const pickUpOrder = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/pick_up',
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to pick up order');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to pick up order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.pickingUp');
  };

  const startTransit = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/start_transit',
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to start transit');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to start transit';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.startingTransit');
  };

  const outForDelivery = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/out_for_delivery',
          request
        );

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Failed to mark as out for delivery'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to mark as out for delivery';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.outForDelivery');
  };

  const deliverOrder = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/deliver',
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to deliver order');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to deliver order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.delivering');
  };

  const failDelivery = async (
    request: OrderStatusChangeRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          '/orders/fail_delivery',
          request
        );

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Failed to mark delivery as failed'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to mark delivery as failed';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.failingDelivery');
  };

  return {
    // Legacy methods
    createOrder,
    updateOrderStatus,

    // Business methods
    confirmOrder,
    startPreparing,
    completePreparation,
    cancelOrder,
    refundOrder,

    // Agent methods
    getOrder,
    pickUpOrder,
    startTransit,
    outForDelivery,
    deliverOrder,
    failDelivery,

    loading: false, // Loading is now handled globally
    error,
  };
};
