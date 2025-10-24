export interface OrderReceiptData {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  current_status: string;
  subtotal: number;
  base_delivery_fee: number;
  per_km_delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  client: {
    user_id: string;
    user: {
      first_name: string;
      last_name: string;
      email: string;
    };
  };
  business: {
    user_id: string;
    name: string;
    business_location: {
      address: {
        address_line_1: string;
        address_line_2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
      };
    };
  };
  assigned_agent?: {
    user_id: string;
    user: {
      first_name: string;
      last_name: string;
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
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    item_name: string;
  }>;
}

export interface ReceiptTemplateData {
  orderNumber: string;
  orderDate: string;
  completionDate: string;
  clientName: string;
  deliveryAddress: string;
  businessName: string;
  businessLocation: string;
  agentName?: string;
  orderItems: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  baseDeliveryFee: number;
  perKmDeliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  currentYear: number;
}

export interface PdfGenerationOptions {
  format: 'A4' | 'Letter';
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  orientation: 'portrait' | 'landscape';
}

export interface PdfEndpointRequest {
  html: string;
  sandbox: boolean;
  options: PdfGenerationOptions;
}

export interface PdfEndpointResponse {
  success: boolean;
  pdf: string; // Base64 encoded PDF
  error?: string;
}
