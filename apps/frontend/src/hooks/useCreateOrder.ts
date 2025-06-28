import { useGraphQLRequest } from './useGraphQLRequest';

const CREATE_ORDER = `
  mutation CreateOrder($orderData: orders_insert_input!) {
    insert_orders_one(object: $orderData) {
      id
      order_number
      client_id
      business_id
      business_location_id
      assigned_agent_id
      delivery_address_id
      subtotal
      delivery_fee
      tax_amount
      total_amount
      currency
      current_status
      estimated_delivery_time
      actual_delivery_time
      special_instructions
      preferred_delivery_time
      payment_method
      payment_status
      created_at
      updated_at
    }
  }
`;

const CREATE_ORDER_ITEM = `
  mutation CreateOrderItem($orderItemData: order_items_insert_input!) {
    insert_order_items_one(object: $orderItemData) {
      id
      order_id
      business_inventory_id
      item_id
      item_name
      item_description
      unit_price
      quantity
      total_price
      weight
      weight_unit
      dimensions
      special_instructions
      created_at
      updated_at
    }
  }
`;

export interface CreateOrderData {
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
  special_instructions?: string;
  preferred_delivery_time?: string;
  payment_method?: string;
  payment_status?: string;
}

export interface CreateOrderItemData {
  order_id?: string;
  business_inventory_id: string;
  item_id: string;
  item_name: string;
  item_description: string;
  unit_price: number;
  quantity: number;
  weight?: number;
  weight_unit?: string;
  dimensions?: string;
  special_instructions?: string;
}

export const useCreateOrder = () => {
  const { execute: executeOrder, loading: orderLoading, error: orderError } = useGraphQLRequest(CREATE_ORDER);
  const { execute: executeOrderItem, loading: itemLoading, error: itemError } = useGraphQLRequest(CREATE_ORDER_ITEM);

  const createOrderWithItems = async (
    orderData: CreateOrderData,
    orderItems: CreateOrderItemData[]
  ) => {
    try {
      // Create the order first
      const orderResult = await executeOrder({ orderData });
      const orderId = orderResult?.insert_orders_one?.id;

      if (!orderId) {
        throw new Error('Failed to create order');
      }

      // Create order items
      const itemPromises = orderItems.map(itemData => 
        executeOrderItem({ 
          orderItemData: {
            ...itemData,
            order_id: orderId,
          }
        })
      );

      await Promise.all(itemPromises);

      return orderResult?.insert_orders_one;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  return {
    createOrderWithItems,
    loading: orderLoading || itemLoading,
    error: orderError || itemError,
  };
}; 