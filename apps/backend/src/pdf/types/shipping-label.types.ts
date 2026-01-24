export interface OrderShippingLabelData {
  id: string;
  order_number: string;
  current_status: string;
  requires_fast_delivery: boolean;
  preferred_delivery_time?: string;
  estimated_delivery_time?: string;
  special_instructions?: string;
  client: {
    user_id: string;
    user: {
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
    };
  };
  business: {
    user_id: string;
    name: string;
  };
  business_location: {
    id: string;
    name: string;
    address: {
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  delivery_address: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  delivery_time_windows: Array<{
    id: string;
    preferred_date: string;
    time_slot_start: string;
    time_slot_end: string;
    is_confirmed?: boolean;
    slot?: {
      slot_name?: string;
      slot_type?: string;
    };
  }>;
  order_items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    weight?: number;
    weight_unit?: string;
    dimensions?: string;
  }>;
}

export interface ShippingLabelTemplateData {
  orderNumber: string;
  businessName: string;
  businessAddress: string;
  businessLocationName: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  scheduledDeliveryTime: string;
  fastDelivery: boolean;
  specialInstructions?: string;
  orderItems: Array<{
    itemName: string;
    quantity: number;
    itemMeta: string;
  }>;
  barcodeDataUrl: string;
}
