export type MobileMoneyVerificationMethod = 'question' | 'transaction';

/** Minimal shape embedded in other entities (e.g. business locations, agents). */
export interface MobilePaymentPhoneSummary {
  id: string;
  phone_e164: string;
  is_verified: boolean;
  verified_at?: string | null;
}

export interface MobilePaymentPhone extends MobilePaymentPhoneSummary {
  user_id: string;
  verified_at: string | null;
  last_verification_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  locationCount?: number;
  linkedToAgent?: boolean;
}

export interface MobilePaymentPhoneStatus {
  phone: MobilePaymentPhone;
  pendingTransaction?: {
    id: string;
    status: string;
    reference: string;
  } | null;
}

export type MobilePaymentPhoneModalMode = 'add' | 'edit' | 'verify';
