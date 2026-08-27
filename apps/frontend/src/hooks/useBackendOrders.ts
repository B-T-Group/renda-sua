import { useCallback, useState } from 'react';
import {
  useOrdersApiPrefix,
  withOrdersApiPrefix,
} from '../contexts/OrdersApiPrefixContext';
import { useApiClient } from './useApiClient';
import { useApiWithLoading } from './useApiWithLoading';
import type { FoodConfirmationStockUpdate } from '../types/food';

export interface OrderItem {
  business_inventory_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  item: OrderItem;
  verified_agent_delivery?: boolean;
  special_instructions?: string;
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

export interface QuickMessageTemplate {
  id: string;
  buttonLabelKey: string;
  buttonLabelEn: string;
  buttonLabelFr: string;
  bodyI18nKey: string;
  bodyDefaultEn: string;
  tagPersonas: Array<'client' | 'agent' | 'business'>;
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
  failure_reason_id?: string; // Required for fail_delivery endpoint
}

export interface CompleteDeliveryRequest {
  orderId: string;
  pin?: string;
  overwriteCode?: string;
  pinMessageId?: string;
  useLatestSharedPin?: boolean;
}

export interface ConfirmOrderData {
  orderId: string;
  notes?: string;
  delivery_time_window_id?: string;
  delivery_window_details?: {
    slot_id: string;
    preferred_date: string;
    special_instructions?: string;
  };
  /** Optional stock corrections for cooked-food lines on this order. */
  food_stock_updates?: FoodConfirmationStockUpdate[];
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

export interface BatchOrderStatusChangeRequest {
  orderIds: string[];
  notes?: string;
  failure_reason_id?: string;
}

export interface BatchOrderStatusChangeItemResult {
  orderId: string;
  success: boolean;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order?: any;
}

export interface BatchOrderStatusChangeResponse {
  success: boolean;
  results: BatchOrderStatusChangeItemResult[];
  message?: string;
}

export interface OrderDetails {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  business_location_id: string;
  assigned_agent_id?: string;
  delivery_address_id?: string | null;
  fulfillment_method?: 'delivery' | 'pickup';
  subtotal: number;
  base_delivery_fee: number;
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
  payment_timing?: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
  reconciliation_status?: 'none' | 'pending_manual_reconciliation' | 'reconciled';
  created_at: string;
  updated_at: string;
  client?: any;
  business?: any;
  business_location?: any;
  delivery_address?: any;
  assigned_agent?: any;
  order_items?: any[];
}

/** NestJS HttpException: prefer `message` over generic `error` (e.g. "Forbidden"). */
function getHttpExceptionMessage(err: any, fallback: string): string {
  const data = err.response?.data;
  if (typeof data?.message === 'string') return data.message;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.error === 'string') return data.error;
  if (typeof err?.message === 'string') return err.message;
  return fallback;
}

export const useBackendOrders = () => {
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();
  const ordersPrefix = useOrdersApiPrefix();
  const op = useCallback(
    (path: string) => withOrdersApiPrefix(ordersPrefix, path),
    [ordersPrefix]
  );
  const { callWithLoading } = useApiWithLoading({
    loadingMessage: 'common.updatingOrder',
  });
  const { callWithLoading: callWithoutGlobalOverlay } = useApiWithLoading({
    showLoading: false,
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
          op('/orders'),
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
          op(`/orders/${orderId}/status`),
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
    request: ConfirmOrderData
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          op('/orders/confirm'),
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to confirm order');
        }

        return response.data;
      } catch (err: any) {
        // Extract error message from response - check message first, then error, then data.message
        const errorMessage =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to confirm order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.confirming');
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
          op('/orders/complete_preparation'),
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

  const completePreparationBatch = async (
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<BatchOrderStatusChangeResponse>(
          op('/orders/batch/complete_preparation'),
          request
        );

        if (!response.data.success && !response.data.results?.length) {
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
    }, 'orders.batch.completingPreparation');
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
          op('/orders/cancel'),
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
          op('/orders/refund'),
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
          op('/orders/get_order'),
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
          op('/orders/pick_up'),
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

  const pickUpOrderBatch = async (
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<BatchOrderStatusChangeResponse>(
          op('/orders/batch/pick_up'),
          request
        );

        if (!response.data.success && !response.data.results?.length) {
          throw new Error(
            response.data.message || 'Failed to pick up orders'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to pick up orders';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.batch.pickingUp');
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
          op('/orders/start_transit'),
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

  const startTransitBatch = async (
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<BatchOrderStatusChangeResponse>(
          op('/orders/batch/start_transit'),
          request
        );

        if (!response.data.success && !response.data.results?.length) {
          throw new Error(
            response.data.message || 'Failed to start transit for orders'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to start transit for orders';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.batch.startingTransit');
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
          op('/orders/out_for_delivery'),
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

  const outForDeliveryBatch = async (
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<BatchOrderStatusChangeResponse>(
          op('/orders/batch/out_for_delivery'),
          request
        );

        if (!response.data.success && !response.data.results?.length) {
          throw new Error(
            response.data.message ||
              'Failed to mark orders as out for delivery'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to mark orders as out for delivery';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.batch.outForDelivery');
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
          op('/orders/deliver'),
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

  const deliverOrderBatch = async (
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<BatchOrderStatusChangeResponse>(
          op('/orders/batch/deliver'),
          request
        );

        if (!response.data.success && !response.data.results?.length) {
          throw new Error(
            response.data.message || 'Failed to deliver orders'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to deliver orders';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.batch.delivering');
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
          '/failed-deliveries/fail',
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

  const completeOrder = async (
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
          op('/orders/complete'),
          request
        );

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to complete order');
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to complete order';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.completing');
  };

  /**
   * Client fallback after agent dispatch escalation is exhausted: switch the
   * order to store pickup and waive the delivery fee.
   */
  const switchToPickup = async (
    orderId: string
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithLoading(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          op('/orders/switch-to-pickup'),
          { orderId }
        );

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Failed to switch order to store pickup'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to switch order to store pickup';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, 'orders.switchingToPickup');
  };

  const completeDelivery = async (
    request: CompleteDeliveryRequest
  ): Promise<OrderStatusChangeResponse> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithoutGlobalOverlay(async () => {
      try {
        const response = await apiClient.post<OrderStatusChangeResponse>(
          op('/orders/complete-delivery'),
          request
        );

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Failed to complete delivery'
          );
        }

        return response.data;
      } catch (err: any) {
        const errorMessage = getHttpExceptionMessage(
          err,
          'Failed to complete delivery'
        );
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  const initiatePayAtDeliveryPayment = async (
    orderId: string,
    phoneNumberOverride?: string
  ): Promise<any> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithoutGlobalOverlay(async () => {
      try {
        const response = await apiClient.post(
          op(`/orders/${orderId}/initiate-pay-at-delivery-payment`),
          phoneNumberOverride?.trim()
            ? { phone_number: phoneNumberOverride.trim() }
            : {}
        );
        return response.data;
      } catch (err: any) {
        const errorMessage = getHttpExceptionMessage(
          err,
          'Failed to initiate pay at delivery payment'
        );
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  const initiatePayAtPickupPayment = async (
    orderId: string,
    phoneNumberOverride?: string
  ): Promise<any> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithoutGlobalOverlay(async () => {
      try {
        const response = await apiClient.post(
          op(`/orders/${orderId}/initiate-pay-at-pickup-payment`),
          phoneNumberOverride?.trim()
            ? { phone_number: phoneNumberOverride.trim() }
            : {}
        );
        return response.data;
      } catch (err: any) {
        const errorMessage = getHttpExceptionMessage(
          err,
          'Failed to initiate pay at pickup payment'
        );
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  const confirmClientPickup = async (
    orderId: string,
    pin: string,
    options?: { useLatestSharedPin?: boolean; pinMessageId?: string }
  ): Promise<any> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithoutGlobalOverlay(async () => {
      try {
        const response = await apiClient.post(
          op(`/orders/${orderId}/confirm-pickup`),
          {
            pin: pin || undefined,
            useLatestSharedPin: options?.useLatestSharedPin,
            pinMessageId: options?.pinMessageId,
          }
        );
        return response.data;
      } catch (err: any) {
        const errorMessage = getHttpExceptionMessage(
          err,
          'Failed to confirm pickup'
        );
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  const retryOrderPayment = async (orderId: string): Promise<any> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithoutGlobalOverlay(async () => {
      try {
        const response = await apiClient.post(op(`/orders/${orderId}/retry-payment`), {});
        return response.data;
      } catch (err: any) {
        const errorMessage = getHttpExceptionMessage(
          err,
          'Failed to retry payment'
        );
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  const markPaidInCashException = async (
    orderId: string,
    notes?: string
  ): Promise<any> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithoutGlobalOverlay(async () => {
      try {
        const response = await apiClient.post(
          op(`/orders/${orderId}/mark-paid-in-cash-exception`),
          { notes }
        );
        return response.data;
      } catch (err: any) {
        const errorMessage = getHttpExceptionMessage(
          err,
          'Failed to mark paid in cash'
        );
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  const reconcileCashException = async (
    orderId: string,
    customerPhone: string,
    reference?: string,
    notes?: string
  ): Promise<any> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    return callWithoutGlobalOverlay(async () => {
      try {
        const response = await apiClient.post(
          op(`/orders/${orderId}/reconcile-cash-exception`),
          { customerPhone, reference, notes }
        );
        return response.data;
      } catch (err: any) {
        const errorMessage = getHttpExceptionMessage(
          err,
          'Failed to reconcile cash exception'
        );
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    });
  };

  const getDeliveryPin = async (
    orderId: string
  ): Promise<{ pin: string }> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    const response = await apiClient.get<{ pin: string }>(
      op(`/orders/${orderId}/delivery-pin`)
    );

    if (!response.data?.pin) {
      throw new Error('Failed to get delivery PIN');
    }

    return response.data;
  };

  const sendDeliveryPin = async (orderId: string): Promise<void> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    const response = await apiClient.post<{ success: boolean }>(
      op(`/orders/${orderId}/messages/delivery-pin`),
      {}
    );

    if (!response.data?.success) {
      throw new Error('Failed to send delivery PIN');
    }
  };

  const getQuickMessageTemplates = async (
    orderId: string
  ): Promise<QuickMessageTemplate[]> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    const response = await apiClient.get<{
      success: boolean;
      templates: QuickMessageTemplate[];
    }>(op(`/orders/${orderId}/messages/quick-templates`));

    return response.data?.templates ?? [];
  };

  const sendQuickMessage = async (
    orderId: string,
    templateId: string
  ): Promise<void> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    const response = await apiClient.post<{ success: boolean }>(
      op(`/orders/${orderId}/messages/quick`),
      { templateId }
    );

    if (!response.data?.success) {
      throw new Error('Failed to send quick message');
    }
  };

  const getActiveDeliveryPin = async (
    orderId: string
  ): Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    const response = await apiClient.get<{
      success: boolean;
      activePin: {
        messageId: string;
        pin: string;
        pinVersion: number;
        sharedAt: string;
      } | null;
    }>(op(`/orders/${orderId}/messages/active-delivery-pin`));

    return response.data?.activePin ?? null;
  };

  const generateDeliveryOverwriteCode = async (
    orderId: string
  ): Promise<{ overwriteCode: string }> => {
    if (!apiClient) {
      throw new Error(
        'API client not available. Please ensure you are authenticated.'
      );
    }

    const response = await apiClient.post<{
      overwriteCode: string;
    }>(op(`/orders/${orderId}/delivery-overwrite-code`), {});

    if (!response.data?.overwriteCode) {
      throw new Error('Failed to generate overwrite code');
    }

    return response.data;
  };

  return {
    // Legacy methods
    createOrder,
    updateOrderStatus,

    // Business methods
    confirmOrder,
    completePreparation,
    completePreparationBatch,
    cancelOrder,
    refundOrder,

    // Agent methods
    getOrder,
    pickUpOrder,
    pickUpOrderBatch,
    startTransit,
    startTransitBatch,
    outForDelivery,
    outForDeliveryBatch,
    deliverOrder,
    deliverOrderBatch,
    failDelivery,

    // Client methods
    completeOrder,
    switchToPickup,

    // PIN-based completion (agent: complete with PIN or overwrite; client: get PIN; business: overwrite code)
    completeDelivery,
    initiatePayAtDeliveryPayment,
    initiatePayAtPickupPayment,
    confirmClientPickup,
    retryOrderPayment,
    markPaidInCashException,
    reconcileCashException,
    getDeliveryPin,
    sendDeliveryPin,
    getQuickMessageTemplates,
    sendQuickMessage,
    getActiveDeliveryPin,
    generateDeliveryOverwriteCode,

    loading: false, // Loading is now handled globally
    error,
  };
};
