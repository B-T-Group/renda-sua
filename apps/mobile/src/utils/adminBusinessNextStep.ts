import type {
  AdminBusinessListItem,
  AdminVerificationBlocker,
} from '../types/adminBusinesses';
import { formatVerificationBlocker } from './adminBusinessVerification';

function pickDraftBlocker(
  blockers: AdminVerificationBlocker[],
  contractComplete: boolean | undefined
): AdminVerificationBlocker | null {
  if (!contractComplete) {
    if (
      blockers.includes('missing_signed_contract') ||
      blockers.length === 0
    ) {
      return 'missing_signed_contract';
    }
  }
  if (blockers.includes('missing_payment_verification')) {
    return 'missing_payment_verification';
  }
  // Catalog blockers are storefront-only; do not surface as lifecycle next steps.
  return null;
}

/**
 * Next-step hint aligned with the 4-status lifecycle (not catalog-as-Draft).
 */
export function formatBusinessNextStep(
  item: Pick<AdminBusinessListItem, 'lifecycle_status' | 'verificationSummary'>,
  t: (key: string, defaultValue: string, options?: Record<string, string>) => string
): string | null {
  const status = item.lifecycle_status;
  const summary = item.verificationSummary;
  const idStatus = summary?.idDocumentStatus;
  const rail = summary?.rail;
  const blockers = summary?.blockers ?? [];

  if (status === 'created') {
    const blocker = pickDraftBlocker(blockers, summary?.contractComplete);
    if (!blocker) {
      return t(
        'admin.businesses.nextStep.draftPendingRecompute',
        'Draft — lifecycle may still be updating after verification'
      );
    }
    const step = formatVerificationBlocker(blocker, t);
    return t(
      'admin.businesses.nextStep.draft',
      'Draft — next step: {{step}}',
      { step }
    );
  }

  if (status === 'contract_signed') {
    if (rail === 'mobile_money' && idStatus && idStatus !== 'approved') {
      if (idStatus === 'pending') {
        return t(
          'admin.businesses.nextStep.idPending',
          'Contract signed — ID awaiting review'
        );
      }
      if (idStatus === 'rejected') {
        return t(
          'admin.businesses.nextStep.idRejected',
          'Contract signed — request a new ID upload'
        );
      }
      return t(
        'admin.businesses.nextStep.idMissing',
        'Contract signed — ask merchant to upload ID'
      );
    }
    if (blockers.includes('missing_payment_verification')) {
      return t(
        'admin.businesses.nextStep.payment',
        'Contract signed — complete payment verification'
      );
    }
    return t(
      'admin.businesses.nextStep.contractSigned',
      'Contract signed — finish verification to go Active'
    );
  }

  if (status === 'suspended') {
    return t(
      'admin.businesses.nextStep.suspended',
      'Suspended — reinstate when ready'
    );
  }

  return null;
}
