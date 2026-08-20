import type { BusinessVerificationStatus } from '../hooks/useBusinessVerification';

export const verifiedBadgeTipDismissKey = (businessId: string) =>
  `rendasua:business:${businessId}:verified-badge-tip-dismissed`;

export function isVerifiedBadgeTipDismissed(businessId: string): boolean {
  return localStorage.getItem(verifiedBadgeTipDismissKey(businessId)) === '1';
}

export function markVerifiedBadgeTipDismissed(businessId: string): void {
  localStorage.setItem(verifiedBadgeTipDismissKey(businessId), '1');
}

/** Soft tip: active store without verified badge; hide while ID is pending/approved/rejected. */
export function shouldShowVerifiedBadgeTip(
  status: BusinessVerificationStatus | null | undefined,
  businessId: string | undefined,
  dismissed: boolean
): boolean {
  if (!businessId || !status) return false;
  if (!status.can_accept_orders || status.is_verified) return false;
  if (dismissed) return false;
  const identityStatus = status.steps.identity?.status;
  // Pending/approved: nothing to tip. Rejected: dedicated review UX owns re-upload.
  if (
    identityStatus === 'pending' ||
    identityStatus === 'approved' ||
    identityStatus === 'rejected'
  ) {
    return false;
  }
  if (status.paymentRail === 'stripe') {
    return status.steps.stripeConnect?.complete !== true;
  }
  return true;
}
