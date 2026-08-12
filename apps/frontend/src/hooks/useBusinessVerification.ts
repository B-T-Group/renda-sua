import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type VerificationNextAction =
  | 'sign_agreement'
  | 'upload_id'
  | 'setup_stripe_connect'
  | 'publish_catalog'
  | 'pending_review'
  | 'verify_mobile_payment_phone'
  | 'complete';

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
  lifecycle_status?: 'created' | 'contract_signed' | 'active' | 'suspended';
  is_storefront_visible?: boolean;
  can_accept_orders?: boolean;
  /** True while lifecycle is not active and not suspended. */
  isOnboarding?: boolean;
  suspension?: {
    code: 'reliability_missed_orders' | 'admin' | 'unknown';
    suspendedAt: string | null;
  } | null;
  accountFullName: string;
  nextAction: VerificationNextAction;
  /** True when nextAction is a merchant setup step (agreement, payouts, or ID). */
  requiresMerchantAction?: boolean;
  paymentRail?: 'stripe' | 'mobile_money';
  contract?: MerchantContractStatus;
  steps: {
    agreement: {
      complete: boolean;
      version?: string | null;
      acceptedAt?: string | null;
      status?: string | null;
      contractId?: string | null;
    };
    identity?: {
      complete: boolean;
      status: 'missing' | 'pending' | 'approved' | 'rejected';
      uploadId?: string | null;
      rejectionReason?: string | null;
    };
    stripeConnect?: {
      complete: boolean;
      status: string;
      connected: boolean;
    };
    catalog?: {
      complete: boolean;
      hasLocation?: boolean;
      hasApprovedItem?: boolean;
      hasPendingItem?: boolean;
      hasApprovedRental?: boolean;
      hasPendingRental?: boolean;
    };
    mobilePaymentPhone?: {
      complete: boolean;
      hasVerifiedPhone: boolean;
      locationCountNeedingPhone: number;
      locationsWithItemsNeedingPhone?: number;
      totalActiveLocations?: number;
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

export function useBusinessVerification(enabled = true) {
  const apiClient = useApiClient();
  const [status, setStatus] = useState<BusinessVerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!apiClient || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: BusinessVerificationStatus }>(
        '/business-verification/status'
      );
      if (res.data.success) setStatus(res.data.data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load verification status');
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
