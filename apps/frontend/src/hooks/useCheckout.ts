import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CartItem, useCart } from '../contexts/CartContext';
import { toOrderItemVariantId } from '../utils/shopperVariantSelection';
import { useApiClient } from './useApiClient';
import { useMetaPixel } from './useMetaPixel';

interface CreateOrderRequest {
  items: Array<{
    business_inventory_id: string;
    quantity: number;
    item_variant_id?: string;
  }>;
  delivery_address_id?: string;
  fulfillment_method?: 'delivery' | 'pickup';
  phone_number?: string;
  special_instructions?: string;
  requires_fast_delivery?: boolean;
  discount_code?: string;
  payment_timing?: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
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
  payment_rail?: 'stripe' | 'mobile_money';
  checkout_url?: string;
  payment_reference?: string;
}

function buildMetaPixelPurchaseFromCart(
  cartItems: CartItem[],
  orders: OrderResult[]
) {
  const value = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const categories = cartItems
    .map((c) => c.itemData.contentCategory?.trim())
    .filter((s): s is string => Boolean(s));
  const unique = [...new Set(categories)];
  const content_category =
    unique.length === 0
      ? undefined
      : unique.length === 1
        ? unique[0]
        : unique.join('; ');

  const gCategories = cartItems
    .map((c) => c.itemData.googleProductCategory?.trim())
    .filter((s): s is string => Boolean(s));
  const gUnique = [...new Set(gCategories)];
  const google_product_category =
    gUnique.length === 0
      ? undefined
      : gUnique.length === 1
        ? gUnique[0]
        : gUnique.join('; ');

  return {
    content_type: 'product' as const,
    content_ids: cartItems.map((c) => c.inventoryItemId),
    contents: cartItems.map((c) => ({
      id: c.inventoryItemId,
      quantity: c.quantity,
      item_price: c.itemData.price,
    })),
    value,
    currency: orders[0]?.currency ?? cartItems[0]?.itemData.currency ?? 'USD',
    ...(content_category && { content_category }),
    ...(google_product_category && { google_product_category }),
  };
}

function parseCheckoutApiError(
  err: any,
  t: (key: string, defaultValue: string) => string
): string {
  const data = err?.response?.data;
  if (data?.error === 'MERCHANT_NOT_ACCEPTING_ORDERS') {
    return (
      data.message ||
      t(
        'checkout.merchantNotAcceptingOrders',
        'This merchant is currently completing account setup and is not yet accepting orders.'
      )
    );
  }
  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message;
  }
  if (typeof data?.error === 'string' && data.error.trim()) {
    return data.error;
  }
  return err?.message || 'Failed to create orders';
}

export const useCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { clearCart } = useCart();
  const { trackPurchase } = useMetaPixel();

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
      deliveryAddressId: string | null,
      phoneNumber?: string,
      specialInstructions?: string,
      discountCode?: string,
      requiresFastDelivery?: boolean,
      fastDeliveryFee?: number,
      paymentTiming: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup' = 'pay_now',
      deliveryWindow?: {
        slot_id: string;
        preferred_date: string;
        special_instructions?: string;
      },
      fulfillmentMethod: 'delivery' | 'pickup' = 'delivery'
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
        const preflightResponse = await apiClient.post('/orders/checkout/preflight', {
          items: cartItems.map((item) => {
            const itemVariantId = toOrderItemVariantId(item.variantId);
            return {
              business_inventory_id: item.inventoryItemId,
              quantity: item.quantity,
              ...(itemVariantId && { item_variant_id: itemVariantId }),
            };
          }),
          ...(fulfillmentMethod === 'delivery' && deliveryAddressId
            ? { delivery_address_id: deliveryAddressId }
            : {}),
          fulfillment_method: fulfillmentMethod,
          phone_number: phoneNumber,
          payment_timing: paymentTiming,
        });

        const preflight = preflightResponse.data;
        const merchantBlocker = preflight?.blocking_errors?.find(
          (b: { code?: string }) => b.code === 'MERCHANT_NOT_ACCEPTING_ORDERS'
        );
        if (merchantBlocker || preflight?.can_proceed === false) {
          const message =
            merchantBlocker?.message ||
            preflight?.blocking_errors?.[0]?.message ||
            t('checkout.error', 'Checkout could not proceed');
          throw Object.assign(new Error(message), {
            response: {
              data: {
                error: merchantBlocker?.code || 'CHECKOUT_BLOCKED',
                message,
              },
            },
          });
        }

        if (
          fulfillmentMethod === 'delivery' &&
          preflight?.delivery_availability?.available === false
        ) {
          const message = t(
            'orders.deliveryAvailability.unavailable',
            'Delivery is currently unavailable.'
          );
          throw Object.assign(new Error(message), {
            response: {
              data: { error: 'DELIVERY_UNAVAILABLE', message },
            },
          });
        }

        // Group items by business
        const itemsByBusiness = groupItemsByBusiness(cartItems);

        // Sequential creation so only the first order receives the first-delivery promo
        const orders: OrderResult[] = [];
        for (const [, items] of itemsByBusiness) {
          const orderData: CreateOrderRequest = {
            items: items.map((item) => {
              const itemVariantId = toOrderItemVariantId(item.variantId);
              return {
                business_inventory_id: item.inventoryItemId,
                quantity: item.quantity,
                ...(itemVariantId && { item_variant_id: itemVariantId }),
              };
            }),
            ...(fulfillmentMethod === 'delivery' && deliveryAddressId
              ? { delivery_address_id: deliveryAddressId }
              : {}),
            fulfillment_method: fulfillmentMethod,
            phone_number: phoneNumber,
            special_instructions: specialInstructions,
            discount_code: discountCode,
            requires_fast_delivery:
              fulfillmentMethod === 'pickup' ? false : requiresFastDelivery,
            payment_timing: paymentTiming,
            ...(fulfillmentMethod === 'delivery' && deliveryWindow
              ? { delivery_window: deliveryWindow }
              : {}),
          };

          const response = await apiClient.post('/orders', orderData);

          if (!response.data.success) {
            throw new Error(
              response.data.message || 'Failed to create order'
            );
          }

          orders.push(response.data.order);
        }

        trackPurchase(buildMetaPixelPurchaseFromCart(cartItems, orders));

        // Clear cart after successful order creation
        clearCart();

        enqueueSnackbar(t('checkout.success', 'Orders created successfully!'), {
          variant: 'success',
        });

        return orders;
      } catch (err: any) {
        const errorMessage = parseCheckoutApiError(err, t);
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
    [apiClient, groupItemsByBusiness, clearCart, enqueueSnackbar, t, trackPurchase]
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
      },
      itemVariantId?: string
    ): Promise<OrderResult> => {
      if (!apiClient) {
        throw new Error('API client not available');
      }

      setLoading(true);
      setError(null);

      try {
        const resolvedVariantId = toOrderItemVariantId(itemVariantId);
        const orderData: CreateOrderRequest = {
          items: [
            {
              business_inventory_id: inventoryItemId,
              quantity: quantity,
              ...(resolvedVariantId && {
                item_variant_id: resolvedVariantId,
              }),
            },
          ],
          delivery_address_id: deliveryAddressId,
          phone_number: phoneNumber,
          special_instructions: specialInstructions,
          requires_fast_delivery: requiresFastDelivery,
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
        const errorMessage = parseCheckoutApiError(err, t);
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
