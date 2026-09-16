/** Shared reject reason keys for reel moderation (i18n: admin.reels.moderation.reasons.*). */
export const REEL_REJECT_REASON_IDS = [
  'inappropriate',
  'misleading',
  'lowQuality',
  'wrongProduct',
  'spam',
  'copyright',
  'other',
] as const;

export type ReelRejectReasonId = (typeof REEL_REJECT_REASON_IDS)[number];

export const REEL_REJECT_REASON_DEFAULTS: Record<ReelRejectReasonId, string> = {
  inappropriate: 'Inappropriate / adult content',
  misleading: 'Misleading product',
  lowQuality: 'Low quality / unusable',
  wrongProduct: 'Wrong or unrelated product',
  spam: 'Spam / promo spam',
  copyright: 'Copyright / trademark',
  other: 'Other',
};

export function resolveReelRejectReason(
  id: ReelRejectReasonId,
  otherText: string,
  label: string
): string {
  if (id === 'other') return otherText.trim();
  const extra = otherText.trim();
  return extra ? `${label}: ${extra}` : label;
}
