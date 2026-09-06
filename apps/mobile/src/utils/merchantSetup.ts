import type {
  BusinessVerificationStatus,
  VerificationNextAction,
} from '../services/businessVerificationApi';
import StorageService from '../services/storage/StorageService';

const MERCHANT_ACTION_NEXT_ACTIONS: ReadonlySet<VerificationNextAction> =
  new Set(['sign_agreement']);

export const goLiveStorageKey = (businessId: string) =>
  `rendasua:business:${businessId}:go-live-celebrated`;

/** True when the merchant still has a setup step to complete. */
export function requiresMerchantAction(
  status: BusinessVerificationStatus | null | undefined
): boolean {
  if (!status) return false;
  if (typeof status.requiresMerchantAction === 'boolean') {
    return status.requiresMerchantAction;
  }
  return MERCHANT_ACTION_NEXT_ACTIONS.has(status.nextAction);
}

/**
 * Focused setup UI while the business is still onboarding (not active / suspended).
 */
export function isSetupMode(
  status: BusinessVerificationStatus | null | undefined
): boolean {
  if (!status) return false;
  if (typeof status.isOnboarding === 'boolean') {
    return status.isOnboarding;
  }
  if (status.lifecycle_status === 'suspended') return false;
  if (status.lifecycle_status === 'active' || status.can_accept_orders) {
    return false;
  }
  return true;
}

export function hasCatalogItem(
  status: BusinessVerificationStatus | null | undefined
): boolean {
  const catalog = status?.steps?.catalog;
  if (!catalog) return false;
  return Boolean(
    catalog.hasApprovedItem ||
      catalog.hasPendingItem ||
      catalog.hasApprovedRental ||
      catalog.hasPendingRental
  );
}

export async function isGoLiveCelebrated(businessId: string): Promise<boolean> {
  const value = await StorageService.getString(goLiveStorageKey(businessId));
  return value === '1';
}

export async function markGoLiveCelebrated(businessId: string): Promise<void> {
  await StorageService.setString(goLiveStorageKey(businessId), '1');
}

/** True when the merchant can accept orders and has not dismissed the celebration. */
export async function shouldShowGoLiveCelebration(
  status: BusinessVerificationStatus | null | undefined,
  businessId: string | undefined
): Promise<boolean> {
  if (!businessId || !status?.can_accept_orders) return false;
  return !(await isGoLiveCelebrated(businessId));
}
