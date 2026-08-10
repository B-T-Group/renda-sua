import {
  BusinessLifecycleStatus,
  BusinessPaymentProvider,
  DbPaymentCapabilityStatus,
  PaymentCapabilityStatus,
} from './merchant-lifecycle.types';

export function mapDbCapabilityStatus(
  status: DbPaymentCapabilityStatus
): PaymentCapabilityStatus {
  switch (status) {
    case 'verified':
      return 'VERIFIED';
    case 'verification_pending':
      return 'VERIFICATION_PENDING';
    case 'rejected':
      return 'REJECTED';
    case 'in_progress':
      return 'IN_PROGRESS';
    default:
      return 'NOT_STARTED';
  }
}

export function aggregatePaymentCapability(
  accounts: DbPaymentCapabilityStatus[]
): PaymentCapabilityStatus {
  if (accounts.some((s) => s === 'verified')) return 'VERIFIED';
  if (accounts.some((s) => s === 'verification_pending' || s === 'rejected')) {
    return 'VERIFICATION_PENDING';
  }
  if (accounts.some((s) => s === 'in_progress')) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export function paymentProviderForRail(
  rail: 'stripe' | 'mobile_money'
): BusinessPaymentProvider {
  return rail === 'stripe' ? 'stripe' : 'mobile_money';
}

export function aggregatePaymentCapabilityForProvider(
  accounts: Array<{
    provider: BusinessPaymentProvider;
    capability_status: DbPaymentCapabilityStatus;
  }>,
  requiredProvider: BusinessPaymentProvider
): PaymentCapabilityStatus {
  const statuses = accounts
    .filter((a) => a.provider === requiredProvider)
    .map((a) => a.capability_status);
  return aggregatePaymentCapability(statuses);
}

export function deriveLifecycleStatus(
  catalogReady: boolean,
  paymentCapability: PaymentCapabilityStatus
): BusinessLifecycleStatus {
  if (!catalogReady) return 'created';
  switch (paymentCapability) {
    case 'VERIFIED':
      return 'active';
    case 'VERIFICATION_PENDING':
    case 'REJECTED':
      return 'payment_verification_pending';
    case 'IN_PROGRESS':
      return 'payment_setup_pending';
    case 'NOT_STARTED':
    default:
      return 'catalog_ready';
  }
}

/**
 * Catalog visibility is rail-aware and independent of order acceptance:
 * - Stripe: visible once agreement is signed (not created/suspended)
 * - Mobile money: visible only when lifecycle is active (agreement + approved ID)
 */
export function deriveStorefrontVisibility(
  rail: 'stripe' | 'mobile_money',
  lifecycleStatus: BusinessLifecycleStatus
): boolean {
  if (lifecycleStatus === 'created' || lifecycleStatus === 'suspended') {
    return false;
  }
  if (rail === 'stripe') return true;
  return lifecycleStatus === 'active';
}
