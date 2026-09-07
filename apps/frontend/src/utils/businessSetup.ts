import type {
  BusinessVerificationStatus,
  VerificationNextAction,
} from '../hooks/useBusinessVerification';

const MERCHANT_ACTION_NEXT_ACTIONS: ReadonlySet<VerificationNextAction> =
  new Set(['sign_agreement', 'setup_stripe_connect']);

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

export function firstItemOnboardingPath(
  mainInterest: 'sell_items' | 'rent_items'
): string {
  return mainInterest === 'rent_items'
    ? '/business/onboarding/add-rental-item'
    : '/business/onboarding/first-sale-item';
}

const previewStorageKey = (businessId: string) =>
  `rendasua:business:${businessId}:previewed-store`;

export function isStorePreviewDone(businessId: string): boolean {
  return localStorage.getItem(previewStorageKey(businessId)) === '1';
}

export function markStorePreviewDone(businessId: string): void {
  localStorage.setItem(previewStorageKey(businessId), '1');
}

const goLiveStorageKey = (businessId: string) =>
  `rendasua:business:${businessId}:go-live-celebrated`;

export function isGoLiveCelebrated(businessId: string): boolean {
  return localStorage.getItem(goLiveStorageKey(businessId)) === '1';
}

export function markGoLiveCelebrated(businessId: string): void {
  localStorage.setItem(goLiveStorageKey(businessId), '1');
}

/** True when the merchant can accept orders and has not dismissed the celebration. */
export function shouldShowGoLiveCelebration(
  status: BusinessVerificationStatus | null | undefined,
  businessId: string | undefined
): boolean {
  if (!businessId || !status?.can_accept_orders) return false;
  return !isGoLiveCelebrated(businessId);
}
