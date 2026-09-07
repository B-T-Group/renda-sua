import type { AdminReferredBy } from './adminUsers';

export type { AdminReferredBy };

export type AdminVerificationBlocker =
  | 'missing_signed_contract'
  | 'missing_active_location'
  | 'missing_approved_product'
  | 'missing_payment_verification';

export type AdminPaymentRail = 'stripe' | 'mobile_money';

export type AdminIdDocumentStatus =
  | 'missing'
  | 'pending'
  | 'rejected'
  | 'approved';

export interface AdminBusinessVerificationSummary {
  contractStatus: string;
  contractComplete: boolean;
  idDocumentStatus: AdminIdDocumentStatus;
  blockers?: AdminVerificationBlocker[];
  rail?: AdminPaymentRail;
}

export interface AdminBusinessListItem {
  id: string;
  name: string;
  lifecycle_status?: string;
  can_accept_orders?: boolean;
  is_storefront_visible?: boolean;
  user_id?: string;
  created_at?: string;
  referralCode?: string;
  referredBy?: AdminReferredBy | null;
  user: {
    first_name: string;
    last_name: string;
    email?: string;
  };
  verificationSummary?: AdminBusinessVerificationSummary;
}

export interface AdminBusinessesListResult {
  items: AdminBusinessListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminBusinessIdDocument {
  id: string;
  file_name: string;
  content_type?: string | null;
  is_approved: boolean;
  note?: string | null;
  document_type?: { name: string };
}

export interface AdminBusinessVerificationDetails {
  business: {
    id: string;
    name: string;
    lifecycle_status?: string;
    can_accept_orders?: boolean;
    is_storefront_visible?: boolean;
    account_type?: 'STANDARD' | 'PREMIUM' | 'ELITE';
    account_type_locked_until?: string | null;
    created_at?: string;
    user: { id?: string; first_name: string; last_name: string; email: string };
  };
  latestAcceptance: {
    signer_legal_name: string;
    agreement_version: string;
    accepted_at: string;
    pdf_upload_id?: string | null;
  } | null;
  latestContract?: {
    complete: boolean;
    status: string | null;
    version: string | null;
    contractId: string | null;
    canDownload: boolean;
    boldSignEnabled?: boolean;
  } | null;
  identityDocuments: AdminBusinessIdDocument[];
  paymentAccounts?: Array<{
    id: string;
    provider: string;
    capability_status: string;
    rejection_reason?: string | null;
  }>;
  rail?: AdminPaymentRail;
  blockers?: AdminVerificationBlocker[];
  catalog?: {
    complete: boolean;
    hasLocation: boolean;
    hasApprovedItem: boolean;
    hasPendingItem: boolean;
    hasApprovedRental?: boolean;
    hasPendingRental?: boolean;
  };
}
