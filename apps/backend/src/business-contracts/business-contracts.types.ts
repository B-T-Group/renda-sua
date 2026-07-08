export type ContractStatus =
  | 'not_sent'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'failed';

export const TERMINAL_CONTRACT_STATUSES: ContractStatus[] = [
  'signed',
  'declined',
  'expired',
  'cancelled',
  'failed',
];

export interface ContractTemplateRow {
  id: string;
  version: string;
  boldsign_template_id_en: string;
  boldsign_template_id_fr?: string | null;
  title?: string | null;
  is_active: boolean;
  is_legacy: boolean;
  resign_required_by?: string | null;
}

export interface BusinessContractRow {
  id: string;
  business_id: string;
  contract_template_id: string;
  contract_version: string;
  boldsign_document_id: string;
  status: ContractStatus;
  signer_name?: string | null;
  signer_email?: string | null;
  signer_ip_address?: string | null;
  signer_user_agent?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  signed_at?: string | null;
  declined_at?: string | null;
  expired_at?: string | null;
  cancelled_at?: string | null;
  failed_at?: string | null;
  decline_reason?: string | null;
  failure_reason?: string | null;
  signed_pdf_s3_key?: string | null;
  audit_certificate_s3_key?: string | null;
  document_hash?: string | null;
  invalidated_at?: string | null;
  invalidation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractStatusSnapshot {
  complete: boolean;
  status: ContractStatus | null;
  version: string | null;
  acceptedAt: string | null;
  contractId: string | null;
  canDownload: boolean;
  boldSignEnabled: boolean;
}

export interface BoldSignWebhookPayload {
  event?: { id?: string; created?: number; eventType?: string };
  data?: {
    documentId?: string;
    messageTitle?: string;
    signerDetails?: Array<{
      signerName?: string;
      signerEmail?: string;
      signerIpAddress?: string;
      userAgent?: string;
      status?: string;
      declineMessage?: string;
    }>;
    errorMessage?: string;
  };
}
