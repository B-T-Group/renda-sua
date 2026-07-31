export interface UserMobilePaymentPhoneRow {
  id: string;
  user_id: string;
  phone_e164: string;
  is_verified: boolean;
  verified_at: string | null;
  last_verification_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MobilePaymentPhoneVerificationStatus {
  phone: UserMobilePaymentPhoneRow;
  pendingTransaction?: {
    id: string;
    status: string;
    reference: string;
  } | null;
}
