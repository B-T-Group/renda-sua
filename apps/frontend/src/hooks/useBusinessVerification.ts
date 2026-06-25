import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type VerificationNextAction =
  | 'sign_agreement'
  | 'upload_id'
  | 'setup_stripe_connect'
  | 'pending_review'
  | 'complete';

export interface BusinessVerificationStatus {
  is_verified: boolean;
  accountFullName: string;
  nextAction: VerificationNextAction;
  paymentRail?: 'stripe' | 'mobile_money';
  steps: {
    agreement: { complete: boolean; version?: string | null; acceptedAt?: string | null };
    identity?: {
      complete: boolean;
      status: 'missing' | 'pending' | 'approved';
      uploadId?: string | null;
    };
    stripeConnect?: {
      complete: boolean;
      status: string;
      connected: boolean;
    };
  };
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
