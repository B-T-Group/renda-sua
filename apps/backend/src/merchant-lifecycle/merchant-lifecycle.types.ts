export type BusinessLifecycleStatus =
  | 'created'
  | 'catalog_ready'
  | 'payment_setup_pending'
  | 'payment_verification_pending'
  | 'active'
  | 'suspended';

export type PaymentCapabilityStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'VERIFICATION_PENDING'
  | 'REJECTED'
  | 'VERIFIED';

export type BusinessPaymentProvider =
  | 'stripe'
  | 'mobile_money'
  | 'paypal'
  | 'bank_transfer';

export type DbPaymentCapabilityStatus =
  | 'not_started'
  | 'in_progress'
  | 'verification_pending'
  | 'verified'
  | 'rejected';

export interface BusinessPaymentAccountRow {
  id: string;
  business_id: string;
  provider: BusinessPaymentProvider;
  capability_status: DbPaymentCapabilityStatus;
  external_reference?: string | null;
  rejection_reason?: string | null;
  verified_at?: string | null;
}

export interface BusinessLifecycleSnapshot {
  id: string;
  lifecycle_status: BusinessLifecycleStatus;
  is_storefront_visible: boolean;
  can_accept_orders: boolean;
  is_verified: boolean;
  name: string;
  merchant_agreement_version?: string | null;
  merchant_agreement_accepted_at?: string | null;
  user?: { id: string; email?: string | null; first_name?: string | null; last_name?: string | null };
}
