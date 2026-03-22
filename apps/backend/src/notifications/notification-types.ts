export interface NotificationData {
  orderId: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  businessEmail: string;
  businessVerified?: boolean;
  agentName?: string;
  agentEmail?: string;
  orderStatus: string;
  orderItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  fastDeliveryFee?: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  deliveryAddress: string;
  estimatedDeliveryTime?: string;
  specialInstructions?: string;
  notes?: string;
  clientPreferredLanguage?: string;
  businessPreferredLanguage?: string;
  agentPreferredLanguage?: string;
}
