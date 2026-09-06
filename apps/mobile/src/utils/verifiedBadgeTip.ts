import type { BusinessVerificationStatus } from '../services/businessVerificationApi';
import StorageService from '../services/storage/StorageService';

export const verifiedBadgeTipDismissKey = (businessId: string) =>
  `rendasua:business:${businessId}:verified-badge-tip-dismissed`;

export async function isVerifiedBadgeTipDismissed(
  businessId: string
): Promise<boolean> {
  const value = await StorageService.getString(
    verifiedBadgeTipDismissKey(businessId)
  );
  return value === '1';
}

export async function markVerifiedBadgeTipDismissed(
  businessId: string
): Promise<void> {
  await StorageService.setString(verifiedBadgeTipDismissKey(businessId), '1');
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
  // Pending/approved: nothing to tip. Rejected: dedicated ID review card owns UX.
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
