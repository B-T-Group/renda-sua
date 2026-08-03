import type {
  BusinessVerificationStatus,
  VerificationNextAction,
} from '../hooks/useBusinessVerification';

const MERCHANT_ACTION_NEXT_ACTIONS: ReadonlySet<VerificationNextAction> =
  new Set([
    'sign_agreement',
    'setup_stripe_connect',
    'upload_id',
    'verify_mobile_payment_phone',
    'publish_catalog',
  ]);

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
 * Focused setup UI: merchant still has steps AND store is not yet live/suspended.
 * Suspended and already-visible storefronts keep the full dashboard + banner.
 */
export function isSetupMode(
  status: BusinessVerificationStatus | null | undefined
): boolean {
  if (!requiresMerchantAction(status) || !status) return false;
  if (status.lifecycle_status === 'suspended') return false;
  if (status.is_storefront_visible) return false;
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
