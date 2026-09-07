import { api } from './apiClient';

export type VerificationNextAction =
  | 'sign_agreement'
  | 'upload_id'
  | 'verify_mobile_payment_phone'
  | 'setup_stripe_connect'
  | 'publish_catalog'
  | 'pending_review'
  | 'complete';

export type VerificationPaymentRail = 'stripe' | 'mobile_money';

export type MerchantLifecycleStatus =
  | 'created'
  | 'contract_signed'
  | 'active'
  | 'suspended';

export type BusinessSuspensionReasonCode =
  | 'reliability_missed_orders'
  | 'admin'
  | 'unknown';

export type BusinessSuspensionInfo = {
  code: BusinessSuspensionReasonCode;
  suspendedAt: string | null;
};

export type MerchantContractStatus = {
  complete: boolean;
  status:
    | 'not_sent'
    | 'sent'
    | 'viewed'
    | 'signed'
    | 'declined'
    | 'expired'
    | 'cancelled'
    | 'failed'
    | null;
  version: string | null;
  acceptedAt: string | null;
  contractId: string | null;
  canDownload: boolean;
  boldSignEnabled: boolean;
};

export interface BusinessVerificationStatus {
  is_verified: boolean;
  lifecycle_status?: MerchantLifecycleStatus | string;
  is_storefront_visible?: boolean;
  can_accept_orders?: boolean;
  /**
   * Focused setup UI. Stripe: until lifecycle is active/suspended.
   * Mobile money: until agreement signed and an ID uploaded.
   */
  isOnboarding?: boolean;
  suspension?: BusinessSuspensionInfo | null;
  accountFullName: string;
  nextAction: VerificationNextAction;
  /** True when nextAction is a merchant setup step (agreement, payouts, or ID). */
  requiresMerchantAction?: boolean;
  /** Rail resolved server-side from the business country (stripe | mobile_money). */
  paymentRail?: VerificationPaymentRail;
  contract?: MerchantContractStatus;
  steps: {
    agreement: {
      complete: boolean;
      version?: string | null;
      acceptedAt?: string | null;
      status?: string | null;
      contractId?: string | null;
    };
    /** Present on the mobile-money rail. */
    identity?: {
      complete: boolean;
      status: 'missing' | 'pending' | 'approved' | 'rejected';
      uploadId?: string | null;
      rejectionReason?: string | null;
    };
    /** Present on the mobile-money rail — confirmed payout phone. */
    mobilePaymentPhone?: {
      complete: boolean;
      hasVerifiedPhone?: boolean;
      locationCountNeedingPhone?: number;
      locationsWithItemsNeedingPhone?: number;
      totalActiveLocations?: number;
    };
    /** Present on the stripe rail. */
    stripeConnect?: { complete: boolean };
    /** Catalog inventory snapshot (MM + Stripe) for UI signals such as phone reminder. */
    catalog?: {
      complete: boolean;
      hasLocation?: boolean;
      hasApprovedItem?: boolean;
      hasPendingItem?: boolean;
      hasApprovedRental?: boolean;
      hasPendingRental?: boolean;
    };
  };
  launchPromo?: {
    status: 'claimed' | 'confirmed' | 'released';
    ordersRemaining: number;
    businessLimit: number | null;
    zeroCommissionOrders: number | null;
    identificationWindowDays: number | null;
    claimedAt: string;
    confirmedAt: string | null;
  } | null;
}

export const businessVerificationApi = {
  getStatus: () =>
    api.get<{ success: boolean; data: BusinessVerificationStatus }>(
      '/business-verification/status'
    ),
  getMerchantAgreement: () =>
    api.get<{
      success: boolean;
      data: { html: string; version: string; locale?: string };
    }>('/business-verification/merchant-agreement'),
  acceptMerchantAgreement: (body: {
    legalName: string;
    agreementVersion: string;
    signatureBase64?: string;
    deviceInfo?: {
      platform?: string;
      osName?: string;
      osVersion?: string;
      modelName?: string;
      appVersion?: string;
      brand?: string;
    };
  }) =>
    api.post<{ success: boolean }>('/business-verification/merchant-agreement/accept', body),
  resendContract: () =>
    api.post<{ success: boolean }>('/business-contracts/resend'),
  refreshContract: () =>
    api.post<{ success: boolean; data: MerchantContractStatus }>(
      '/business-contracts/refresh'
    ),
};
