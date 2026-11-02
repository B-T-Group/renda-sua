/**
 * Rejected-item recovery & appeals contract (spec §2–§5).
 * Backend is landing in parallel — keep this the only client shape.
 */

export type RejectionCategory =
  | 'photo_quality'
  | 'prohibited_item'
  | 'counterfeit'
  | 'wrong_condition'
  | 'missing_info'
  | 'pricing'
  | 'other';

export type ItemCondition = 'new' | 'used' | 'refurbished';

export type AppealStatus = 'pending' | 'upheld' | 'overturned' | 'withdrawn';

export type RecoveryActionId =
  | 'aiFix'
  | 'retake'
  | 'condition'
  | 'resubmit'
  | 'appeal'
  | 'editFields'
  | 'editPrice';

export interface RejectionAllowedActions {
  aiFix: boolean;
  retake: boolean;
  condition: boolean;
  resubmit: boolean;
  appeal: boolean;
  editFields?: boolean;
  editPrice?: boolean;
}

export interface ItemRejection {
  id: string;
  item_id: string;
  category: RejectionCategory;
  reason: string;
  reviewer_id?: string | null;
  created_at: string;
}

export interface ItemAppeal {
  id: string;
  rejection_id: string;
  item_id: string;
  business_id?: string;
  reason: string;
  evidence_urls: string[];
  status: AppealStatus;
  admin_id?: string | null;
  admin_note?: string | null;
  decided_at?: string | null;
  sla_due_at?: string | null;
}

export interface ItemRejectionRecovery {
  item_id: string;
  moderation_status: string;
  rejection: ItemRejection | null;
  allowed_actions: RejectionAllowedActions;
  appeal: ItemAppeal | null;
  appeal_history: ItemAppeal[];
  appeal_allowance_remaining: number;
  tokens_used_on_item: number;
  ai_tokens: number;
  cleanup_token_cost: number;
  condition: ItemCondition | null;
  wear_note: string | null;
  pending_resubmit: boolean;
  translation_available?: boolean;
}

export interface RecoveryItemSnapshot {
  id: string;
  moderation_status?: string | null;
  rejection_reason?: string | null;
  rejection_category?: RejectionCategory | null;
  condition?: ItemCondition | null;
  wear_note?: string | null;
  is_used?: boolean | null;
  updated_at?: string | null;
  tokens_used_on_item?: number | null;
  ai_tokens?: number | null;
  cleanup_token_cost?: number | null;
  current_rejection?: ItemRejection | null;
  current_appeal?: ItemAppeal | null;
  appeal_history?: ItemAppeal[] | null;
  appeal_allowance_remaining?: number | null;
  allowed_recovery_actions?: RejectionAllowedActions | null;
  translation_available?: boolean | null;
}

export type AppealTileDisabledReason =
  | 'in_review'
  | 'allowance_used'
  | 'not_allowed'
  | null;

export type RecoveryChipTone = 'warning' | 'error' | 'info' | 'success' | 'default';

export interface RecoveryChipPresentation {
  tone: RecoveryChipTone;
  labelKey: string;
  defaultLabel: string;
}

export interface WearNoteValidation {
  valid: boolean;
  errorKey?: string;
  defaultMessage?: string;
}

export interface AppealReasonValidation {
  valid: boolean;
  errorKey?: string;
  defaultMessage?: string;
}

export interface AppealEvidenceValidation {
  valid: boolean;
  errorKey?: string;
  defaultMessage?: string;
}

export const RECOVERY_ERROR_CODES = {
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  APPEAL_NOT_ALLOWED: 'APPEAL_NOT_ALLOWED',
  APPEAL_ALLOWANCE_USED: 'APPEAL_ALLOWANCE_USED',
  RESUBMIT_PENDING: 'RESUBMIT_PENDING',
  ITEM_NOT_REJECTED: 'ITEM_NOT_REJECTED',
  REASON_TOO_SHORT: 'REASON_TOO_SHORT',
  REASON_TOO_LONG: 'REASON_TOO_LONG',
  EVIDENCE_LIMIT: 'EVIDENCE_LIMIT',
  APPEAL_PENDING_WITHDRAW_REQUIRED: 'APPEAL_PENDING_WITHDRAW_REQUIRED',
  WEAR_NOTE_REQUIRED: 'WEAR_NOTE_REQUIRED',
  WEAR_NOTE_TOO_SHORT: 'WEAR_NOTE_TOO_SHORT',
  WEAR_NOTE_TOO_LONG: 'WEAR_NOTE_TOO_LONG',
} as const;

export type RecoveryErrorCode =
  (typeof RECOVERY_ERROR_CODES)[keyof typeof RECOVERY_ERROR_CODES];

export const NOT_ALLOWED_CATEGORIES: readonly RejectionCategory[] = [
  'prohibited_item',
  'counterfeit',
];

export const REJECTION_CATEGORIES: readonly RejectionCategory[] = [
  'photo_quality',
  'prohibited_item',
  'counterfeit',
  'wrong_condition',
  'missing_info',
  'pricing',
  'other',
];

export const APPEAL_REASON_MIN = 20;
export const APPEAL_REASON_MAX = 500;
export const APPEAL_EVIDENCE_MAX = 3;
export const WEAR_NOTE_MIN = 10;
export const WEAR_NOTE_MAX = 300;
export const DEFAULT_CLEANUP_TOKEN_COST = 1;
export const DEFAULT_APPEAL_LIMIT = 1;

/** GraphQL fields the backend will add on `items` (REST is the client path). */
export const ITEM_REJECTION_RECOVERY_GQL_FIELDS = [
  'rejection_category',
  'condition',
  'wear_note',
  'tokens_used_on_item',
  'current_rejection { id category reason created_at reviewer_id }',
  'current_appeal { id status reason evidence_urls admin_note decided_at sla_due_at }',
  'allowed_recovery_actions { aiFix retake condition resubmit appeal editFields editPrice }',
].join('\n');
