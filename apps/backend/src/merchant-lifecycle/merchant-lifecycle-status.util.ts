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

export function mapCapabilityStatusToDb(
  status: PaymentCapabilityStatus
): DbPaymentCapabilityStatus {
  switch (status) {
    case 'VERIFIED':
      return 'verified';
    case 'VERIFICATION_PENDING':
      return 'verification_pending';
    case 'REJECTED':
      return 'rejected';
    case 'IN_PROGRESS':
      return 'in_progress';
    default:
      return 'not_started';
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

/** Active once the merchant agreement is signed (payment proof is the badge). */
export function deriveLifecycleStatus(
  contractSigned: boolean
): BusinessLifecycleStatus {
  return contractSigned ? 'active' : 'created';
}

/**
 * Storefront verified badge from rail payment capability:
 * MM = approved ID; Stripe = Connect charges+payouts enabled.
 */
export function deriveVerifiedBadge(
  paymentCapability: PaymentCapabilityStatus
): boolean {
  return paymentCapability === 'VERIFIED';
}

/**
 * Catalog visibility is status-based and independent of order acceptance:
 * visible once the merchant agreement is signed (contract_signed or active).
 */
export function deriveStorefrontVisibility(
  lifecycleStatus: BusinessLifecycleStatus
): boolean {
  return lifecycleStatus === 'contract_signed' || lifecycleStatus === 'active';
}
