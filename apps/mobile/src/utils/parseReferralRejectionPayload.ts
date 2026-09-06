import type { ReferralRejectionPayload } from '../types/referralRejection';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseReferralRejectionPayload(
  data: Record<string, unknown> | null | undefined
): ReferralRejectionPayload | null {
  if (!data) return null;
  const event = asString(data.event);
  if (event !== 'business_referral_review_rejected') return null;
  const rejectionReason =
    asString(data.rejectionReason) ?? asString(data.reason);
  const businessName = asString(data.businessName) ?? 'Business';
  if (!rejectionReason) return null;
  return {
    businessId: asString(data.businessId),
    businessName,
    rejectionReason,
    reviewId: asString(data.reviewId),
  };
}

/** Only accepts pushes tagged with the rejection event (never generic title/body). */
export function parseReferralRejectionFromNotification(content: {
  title?: unknown;
  body?: unknown;
  data?: Record<string, unknown>;
}): ReferralRejectionPayload | null {
  return parseReferralRejectionPayload(content.data);
}
