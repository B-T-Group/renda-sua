/**
 * Rejected-item recovery + appeals (spec: rejected-item-recovery-appeal-ux-ac.md).
 * B8: the single server-side map of category -> allowed actions. Clients render
 * only what this returns; nothing here is duplicated client-side.
 */
export const REJECTION_CATEGORIES = [
  'photo_quality',
  'prohibited_item',
  'counterfeit',
  'wrong_condition',
  'missing_info',
  'pricing',
  'other',
] as const;
export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export const ITEM_CONDITIONS = ['new', 'used', 'refurbished'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const APPEAL_STATUSES = ['pending', 'upheld', 'overturned', 'withdrawn'] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const RECOVERY_ACTIONS = ['ai_fix', 'retake', 'condition', 'resubmit', 'appeal'] as const;
export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number];

/** Which "edit" link the resubmit tile carries (§2: missing_info -> fields, pricing -> price). */
export type ResubmitEditLink = 'fields' | 'price' | null;

export interface CategoryActions {
  actions: RecoveryAction[];
  resubmitEditLink: ResubmitEditLink;
  /** "Not allowed" (red) vs "Needs changes" (amber). */
  display: 'needs_changes' | 'not_allowed';
}

export const CATEGORY_ACTIONS: Readonly<Record<RejectionCategory, CategoryActions>> = {
  photo_quality: { actions: ['ai_fix', 'retake', 'resubmit', 'appeal'], resubmitEditLink: null, display: 'needs_changes' },
  wrong_condition: { actions: ['retake', 'condition', 'resubmit', 'appeal'], resubmitEditLink: null, display: 'needs_changes' },
  missing_info: { actions: ['retake', 'condition', 'resubmit', 'appeal'], resubmitEditLink: 'fields', display: 'needs_changes' },
  pricing: { actions: ['resubmit', 'appeal'], resubmitEditLink: 'price', display: 'needs_changes' },
  other: { actions: ['ai_fix', 'retake', 'condition', 'resubmit', 'appeal'], resubmitEditLink: null, display: 'needs_changes' },
  prohibited_item: { actions: ['appeal'], resubmitEditLink: null, display: 'not_allowed' },
  counterfeit: { actions: ['appeal'], resubmitEditLink: null, display: 'not_allowed' },
};

export function isRejectionCategory(v: unknown): v is RejectionCategory {
  return typeof v === 'string' && (REJECTION_CATEGORIES as readonly string[]).includes(v);
}

export function categoryActions(category: string | null | undefined): CategoryActions {
  return isRejectionCategory(category) ? CATEGORY_ACTIONS[category] : CATEGORY_ACTIONS.other;
}

export function categoryAllows(category: string | null | undefined, action: RecoveryAction): boolean {
  return categoryActions(category).actions.includes(action);
}

/** Coded errors (409 unless noted). Clients map `code`, never the message. */
export const RECOVERY_ERRORS = {
  NOT_OWNER: 'ITEM_APPEAL_NOT_OWNER', // 403
  ITEM_NOT_REJECTED: 'ITEM_NOT_REJECTED',
  RESUBMIT_PENDING: 'ITEM_RESUBMIT_PENDING',
  APPEAL_PENDING: 'ITEM_APPEAL_ALREADY_PENDING',
  APPEAL_LIMIT_REACHED: 'ITEM_APPEAL_LIMIT_REACHED',
  APPEAL_NOT_PENDING: 'ITEM_APPEAL_NOT_PENDING',
  REASON_LENGTH: 'ITEM_APPEAL_REASON_LENGTH', // 400
  EVIDENCE_LIMIT: 'ITEM_APPEAL_EVIDENCE_LIMIT', // 400
  WITHDRAW_CONFIRM_REQUIRED: 'ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED',
  ACTION_NOT_ALLOWED: 'ITEM_ACTION_NOT_ALLOWED_FOR_CATEGORY',
  WEAR_NOTE_REQUIRED: 'ITEM_WEAR_NOTE_REQUIRED', // 400
  WEAR_NOTE_LENGTH: 'ITEM_WEAR_NOTE_LENGTH', // 400
  UPHOLD_NOTE_REQUIRED: 'ITEM_APPEAL_UPHOLD_NOTE_REQUIRED', // 400
  SELF_REVIEW_BLOCKED: 'ITEM_APPEAL_SELF_REVIEW_BLOCKED',
  CATEGORY_REQUIRED: 'ITEM_REJECTION_CATEGORY_REQUIRED', // 400
  INSUFFICIENT_AI_TOKENS: 'INSUFFICIENT_AI_TOKENS', // existing cleanup code (402 on run)
} as const;

export const APPEAL_REASON_MIN = 20;
export const APPEAL_REASON_MAX = 500;
export const APPEAL_EVIDENCE_MAX = 3;
export const WEAR_NOTE_MIN = 10;
export const WEAR_NOTE_MAX = 300;

export const CONFIG_APPEAL_LIMIT = 'item_appeal_limit_per_rejection';
export const CONFIG_APPEAL_SLA_HOURS = 'item_appeal_sla_hours';
export const DEFAULT_APPEAL_LIMIT = 1;
export const DEFAULT_APPEAL_SLA_HOURS = 48;
/** Amber at 75% of the SLA (36 h of 48 h). */
export const SLA_WARNING_FRACTION = 0.75;
/** Copy-only: "usually within 24 h" (one global review SLA, starred default). */
export const REVIEW_SLA_HOURS = 24;

export type SlaState = 'ok' | 'warning' | 'breached';

export function slaState(createdAt: string, slaDueAt: string, now: Date): SlaState {
  const start = new Date(createdAt).getTime();
  const due = new Date(slaDueAt).getTime();
  const t = now.getTime();
  if (t >= due) return 'breached';
  if (t - start >= (due - start) * SLA_WARNING_FRACTION) return 'warning';
  return 'ok';
}

/** Status chip the clients show (W1): needs_changes / not_allowed / in_review / other states pass through. */
export function statusDisplay(
  moderationStatus: string,
  category: string | null | undefined
): 'needs_changes' | 'not_allowed' | 'in_review' | 'approved' | 'draft' {
  if (moderationStatus === 'rejected') return categoryActions(category).display;
  if (moderationStatus === 'approved') return 'approved';
  if (moderationStatus === 'draft') return 'draft';
  return 'in_review';
}

/**
 * Edge case "overturned appeal on an edited item": strictly after the rejection
 * (the rejection insert and its pointer update share one transaction timestamp).
 */
export function editedSinceRejection(
  rejectionCreatedAt: string,
  item: { updated_at?: string | null; item_images?: Array<{ created_at?: string | null; updated_at?: string | null }> }
): boolean {
  const cut = new Date(rejectionCreatedAt).getTime();
  const after = (ts?: string | null) => !!ts && new Date(ts).getTime() > cut;
  if (after(item.updated_at)) return true;
  return (item.item_images ?? []).some((img) => after(img.created_at) || after(img.updated_at));
}

/** Best-effort category for AI rejections, from the model's flagged fields/codes. */
export function categoryFromAiIssues(
  issues: Array<{ field?: string | null; code?: string | null }> | null | undefined
): RejectionCategory {
  const list = (issues ?? []).filter(Boolean);
  if (!list.length) return 'other';
  const codes = list.map((i) => (i.code ?? '').toLowerCase());
  const fields = list.map((i) => (i.field ?? '').toLowerCase());
  if (codes.some((c) => /prohibit|banned|illegal/.test(c))) return 'prohibited_item';
  if (codes.some((c) => /counterfeit|fake|replica/.test(c))) return 'counterfeit';
  if (fields.every((f) => /image|photo/.test(f))) return 'photo_quality';
  if (fields.some((f) => /price/.test(f))) return 'pricing';
  if (codes.some((c) => /condition|used|wear/.test(c))) return 'wrong_condition';
  if (fields.some((f) => /title|name|description/.test(f))) return 'missing_info';
  return 'other';
}
