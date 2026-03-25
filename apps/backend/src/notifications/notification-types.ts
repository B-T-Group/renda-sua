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

export interface RentalPeriodEndedEmailPayload {
  bookingId: string;
  rentalItemName: string;
  endAt: string;
  clientUserId: string;
  businessUserId: string;
}

export interface RentalListingModerationEmailPayload {
  listingId: string;
  rentalItemName: string;
  businessUserId: string;
}

export interface RentalListingRejectedEmailPayload
  extends RentalListingModerationEmailPayload {
  rejectionReason: string;
}

export interface BusinessRentalBookingRequestEmailPayload {
  businessUserId: string;
  requestId: string;
  listingId: string;
  rentalItemName: string;
  locationName: string;
  requestedStartAt: string;
  requestedEndAt: string;
  clientName: string;
}

export interface ClientRentalRequestAcceptedEmailPayload {
  clientUserId: string;
  requestId: string;
  rentalItemName: string;
  businessName: string;
  bookingNumber: string;
  contractExpiresAt: string;
  requestedStartAt: string;
  requestedEndAt: string;
}

export interface ClientRentalRequestRejectedEmailPayload {
  clientUserId: string;
  requestId: string;
  rentalItemName: string;
  businessName: string;
  unavailableReasonCode: string;
  businessResponseNote?: string | null;
}
