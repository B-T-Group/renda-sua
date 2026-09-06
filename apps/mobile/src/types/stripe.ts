export type StripePaymentEntity =
  | 'order'
  | 'account'
  | 'claim_order'
  | 'rental_booking'
  | 'order_cash_reconciliation';

export interface InitiateStripePaymentBody {
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  accountId?: string;
  paymentEntity?: StripePaymentEntity;
  entityId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface InitiateStripePaymentResponse {
  success: boolean;
  data?: {
    transactionId: string;
    reference: string;
    sessionId: string;
    paymentUrl?: string;
  };
  message?: string;
}

export interface StripeTransactionStatusResponse {
  success: boolean;
  data?: {
    transactionId: string;
    reference: string;
    status:
      | 'pending'
      | 'success'
      | 'failed'
      | 'cancelled'
      | 'authorized'
      | 'capture_pending'
      | 'expired';
  };
}

export interface StripeConnectStatusResponse {
  success: boolean;
  data?: {
    connected: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    status: string;
    paymentRail?: 'stripe' | 'mobile_money';
  };
}

export interface StripeClientConfigResponse {
  success: boolean;
  data?: {
    publishableKey: string;
  };
  message?: string;
}

export interface StripeConnectLinkResponse {
  success: boolean;
  data?: { url: string };
}

export interface StripeWithdrawBody {
  amount: number;
  currency: string;
  accountId: string;
  description?: string;
}

export interface StripeWithdrawResponse {
  success: boolean;
  data?: {
    transactionId: string;
    transferId?: string;
    message?: string;
  };
  message?: string;
}
