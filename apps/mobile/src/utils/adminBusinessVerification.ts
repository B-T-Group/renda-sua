import type { AdminVerificationBlocker } from '../types/adminBusinesses';

export function formatVerificationBlocker(
  blocker: AdminVerificationBlocker | string,
  t: (key: string, defaultValue: string) => string
): string {
  switch (blocker) {
    case 'missing_signed_contract':
      return t(
        'admin.businesses.blockers.missingSignedContract',
        'Missing: signed contract'
      );
    case 'missing_active_location':
      return t(
        'admin.businesses.blockers.missingActiveLocation',
        'Missing: active location'
      );
    case 'missing_approved_product':
      return t(
        'admin.businesses.blockers.missingApprovedProduct',
        'Missing: approved product or rental'
      );
    case 'missing_payment_verification':
      return t(
        'admin.businesses.blockers.missingPaymentVerification',
        'No verified badge yet (ID or Stripe Connect)'
      );
    default:
      return String(blocker);
  }
}

export function isImageUpload(
  contentType?: string | null,
  fileName?: string
): boolean {
  if (contentType?.startsWith('image/')) return true;
  const lower = (fileName || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some((ext) =>
    lower.endsWith(ext)
  );
}

export function isPdfUpload(
  contentType?: string | null,
  fileName?: string
): boolean {
  if (contentType === 'application/pdf') return true;
  return (fileName || '').toLowerCase().endsWith('.pdf');
}
