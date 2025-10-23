import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CartItem, useCart } from '../contexts/CartContext';
import { useApiClient } from './useApiClient';

interface CreateOrderRequest {
  items: Array<{
    business_inventory_id: string;
    quantity: number;
  }>;
  delivery_address_id: string;
  phone_number?: string;
  special_instructions?: string;
  requires_fast_delivery?: boolean;
  delivery_window?: {
    slot_id: string;
    preferred_date: string;
    special_instructions?: string;
  };
}

interface OrderResult {
  id: string;
  order_number: string;
  total_amount: number;
  currency: string;
  current_status: string;
  business_id: string;
}

export const useCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { clearCart } = useCart();

  const groupItemsByBusiness = useCallback((cartItems: CartItem[]) => {
    const itemsByBusiness = new Map<string, CartItem[]>();

    cartItems.forEach((item) => {
      const businessItems = itemsByBusiness.get(item.businessId) || [];
      businessItems.push(item);
      itemsByBusiness.set(item.businessId, businessItems);
    });

    return itemsByBusiness;
  }, []);

  const createOrdersFromCart = useCallback(
    async (
      cartItems: CartItem[],
      deliveryAddressId: string,
      phoneNumber?: string,
      specialInstructions?: string,
      requiresFastDelivery?: boolean,
      fastDeliveryFee?: number,
      deliveryWindow?: {
        slot_id: string;
        preferred_date: string;
        special_instructions?: string;
      }
    ): Promise<OrderResult[]> => {
      if (!apiClient) {
        throw new Error('API client not available');
      }

      if (cartItems.length === 0) {
        throw new Error('No items in cart');
      }

      setLoading(true);
      setError(null);

      try {
        // Group items by business
        const itemsByBusiness = groupItemsByBusiness(cartItems);

        // Create separate order for each business
        const orderPromises = Array.from(itemsByBusiness.entries()).map(
          async ([businessId, items]) => {
            const orderData: CreateOrderRequest = {
              items: items.map((item) => ({
                business_inventory_id: item.inventoryItemId,
                quantity: item.quantity,
              })),
              delivery_address_id: deliveryAddressId,
              phone_number: phoneNumber,
              special_instructions: specialInstructions,
              requires_fast_delivery: requiresFastDelivery,
              delivery_window: deliveryWindow,
            };

            const response = await apiClient.post('/orders', orderData);

            if (!response.data.success) {
              throw new Error(
                response.data.message || 'Failed to create order'
              );
            }

            return response.data.order;
          }
        );

        const orders = await Promise.all(orderPromises);

        // Clear cart after successful order creation
        clearCart();

        enqueueSnackbar(t('checkout.success', 'Orders created successfully!'), {
          variant: 'success',
        });

        return orders;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to create orders';
        setError(errorMessage);

        enqueueSnackbar(
          t('checkout.error', 'Failed to create orders: {{error}}', {
            error: errorMessage,
          }),
          { variant: 'error' }
        );

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, groupItemsByBusiness, clearCart, enqueueSnackbar, t]
  );

  const createSingleOrder = useCallback(
    async (
      inventoryItemId: string,
      quantity: number,
      businessId: string,
      deliveryAddressId: string,
      phoneNumber?: string,
      specialInstructions?: string,
      requiresFastDelivery?: boolean,
      fastDeliveryFee?: number,
      deliveryWindow?: {
        slot_id: string;
        preferred_date: string;
        special_instructions?: string;
      }
    ): Promise<OrderResult> => {
      if (!apiClient) {
        throw new Error('API client not available');
      }

      setLoading(true);
      setError(null);

      try {
        const orderData: CreateOrderRequest = {
          items: [
            {
              business_inventory_id: inventoryItemId,
              quantity: quantity,
            },
          ],
          delivery_address_id: deliveryAddressId,
          phone_number: phoneNumber,
          special_instructions: specialInstructions,
          requires_fast_delivery: requiresFastDelivery,
          fast_delivery_fee: fastDeliveryFee,
          delivery_window: deliveryWindow,
        };

        const response = await apiClient.post('/orders', orderData);

        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to create order');
        }

        enqueueSnackbar(t('checkout.success', 'Order created successfully!'), {
          variant: 'success',
        });

        return response.data.order;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to create order';
        setError(errorMessage);

        enqueueSnackbar(
          t('checkout.error', 'Failed to create order: {{error}}', {
            error: errorMessage,
          }),
          { variant: 'error' }
        );

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, enqueueSnackbar, t]
  );

  const proceedToOrderConfirmation = useCallback(
    (orders: OrderResult[]) => {
      // Navigate to order confirmation with multiple orders
      navigate('/orders/confirmation', {
        state: {
          orders: orders,
          multipleOrders: orders.length > 1,
        },
      });
    },
    [navigate]
  );

  return {
    createOrdersFromCart,
    createSingleOrder,
    proceedToOrderConfirmation,
    loading,
    error,
  };
};
