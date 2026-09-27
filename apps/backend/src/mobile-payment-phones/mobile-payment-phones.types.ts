export type MobileMoneyVerificationMethod = 'question' | 'transaction';

export interface UserMobilePaymentPhoneRow {
  id: string;
  user_id: string;
  phone_e164: string;
  is_verified: boolean;
  is_default: boolean;
  verified_at: string | null;
  last_verification_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  /** Present on list responses when usage aggregates are loaded. */
  locationCount?: number;
  linkedToAgent?: boolean;
}

export type CheckoutPaymentPhoneSource = 'registry' | 'profile' | 'none';

export interface ResolvedCheckoutPaymentPhone {
  phoneE164: string | null;
  phoneId: string | null;
  source: CheckoutPaymentPhoneSource;
}

export interface MobilePaymentPhoneVerificationStatus {
  phone: UserMobilePaymentPhoneRow;
  pendingTransaction?: {
    id: string;
    status: string;
    reference: string;
  } | null;
}
