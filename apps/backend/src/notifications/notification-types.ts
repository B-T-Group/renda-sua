export interface NotificationData {
  orderId: string;
  /** Client profile id (orders.client_id) for SMS dedupe / lookups */
  clientId?: string;
  orderNumber: string;
  clientName: string;
  /** Omit or null when the user has no email — email notifications are skipped for that recipient */
  clientEmail?: string | null;
  /** Client phone for SMS fallback when email is absent */
  clientPhone?: string | null;
  businessName: string;
  /** Store or location name (e.g. Downtown Store), when available */
  businessLocationName?: string;
  businessEmail?: string | null;
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

export interface FirstOrderCompletedEmailPayload {
  to: string;
  preferredLanguage?: string | null;
  clientName: string;
  discountCode: string;
  orderUrl: string;
}

export interface ReferralRewardEmailPayload {
  to: string;
  preferredLanguage?: string | null;
  clientName: string;
  discountCode: string;
}

export interface ClientOrderPaymentFailedEmailPayload {
  to: string;
  preferredLanguage?: string | null;
  clientName: string;
  orderNumber: string;
  orderUrl: string;
  failureMessage: string;
}

export interface AgentOrderPaymentFailedEmailPayload {
  to: string;
  preferredLanguage?: string | null;
  agentName: string;
  orderNumber: string;
  orderUrl: string;
  failureMessage: string;
}
