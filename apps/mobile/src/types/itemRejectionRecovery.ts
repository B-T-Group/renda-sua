/**
 * Rejected-item recovery + appeals — matches Nest REST contract (PR #746).
 * Map `code`, never `error` text.
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

export type RecoveryAction = 'ai_fix' | 'retake' | 'condition' | 'resubmit' | 'appeal';

export type RecoveryTileId = RecoveryAction | 'edit_fields' | 'edit_price';

export type ResubmitEditLink = 'fields' | 'price' | null;

export type StatusDisplay =
  | 'needs_changes'
  | 'not_allowed'
  | 'in_review'
  | 'approved'
  | 'draft';

export type SlaState = 'ok' | 'warning' | 'breached';

export type WithdrawnReason = 'resubmitted' | 'item_deleted' | 'business' | 'superseded';

export interface ItemRejection {
  id: string;
  category: RejectionCategory | null;
  reason: string;
  source?: 'admin' | 'ai' | 'backfill';
  decidedBy?: 'admin' | 'ai';
  reviewerId?: string | null;
  createdAt: string;
  itemSnapshot?: ItemSnapshot | null;
}

export interface AppealEvidence {
  key: string;
  url: string;
  expiresAt: string;
}

export interface ItemAppeal {
  id: string;
  rejectionId: string;
  itemId: string;
  businessId?: string;
  reason: string;
  evidence: AppealEvidence[];
  status: AppealStatus;
  adminNote?: string | null;
  outcomeModerationStatus?: string | null;
  correctedCategory?: RejectionCategory | null;
  withdrawnReason?: WithdrawnReason | null;
  decidedAt?: string | null;
  slaDueAt?: string | null;
  slaState?: SlaState | null;
  createdAt?: string;
}

export interface RecoveryItemState {
  id: string;
  name: string;
  moderationStatus: string;
  statusDisplay: StatusDisplay | string;
  condition: ItemCondition | null;
  wearNote: string | null;
}

export interface AiCleanupQuote {
  imageCount: number;
  costPerImage: number;
  totalCost: number;
  tokenBalance: number;
  sufficient: boolean;
  shortfall: number;
  code: string | null;
}

export interface ItemRejectionRecovery {
  item: RecoveryItemState;
  rejection: ItemRejection | null;
  actions: RecoveryAction[];
  resubmitEditLink: ResubmitEditLink;
  appeal: ItemAppeal | null;
  appealsUsed: number;
  appealLimit: number;
  canAppeal: boolean;
  canResubmit: boolean;
  resubmitWithdrawsAppeal: boolean;
  aiCleanup: {
    costPerImage: number;
    tokenBalance: number;
    tokensSpentOnItem: number;
  };
  reviewSlaHours: number;
  appealSlaHours: number;
}

export interface ItemSnapshot {
  id?: string;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  condition?: ItemCondition | null;
  wear_note?: string | null;
  is_used?: boolean | null;
  item_images?: Array<{
    id?: string;
    image_url?: string | null;
    display_order?: number | null;
  }>;
}

export interface ResubmitResult {
  itemId: string;
  moderationStatus: string;
  withdrewAppealId: string | null;
}

export interface ConditionUpdateResult {
  itemId: string;
  condition: ItemCondition;
  wearNote: string | null;
  isUsed: boolean;
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
  ITEM_APPEAL_NOT_OWNER: 'ITEM_APPEAL_NOT_OWNER',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  ITEM_APPEAL_NOT_FOUND: 'ITEM_APPEAL_NOT_FOUND',
  ITEM_NOT_REJECTED: 'ITEM_NOT_REJECTED',
  ITEM_RESUBMIT_PENDING: 'ITEM_RESUBMIT_PENDING',
  ITEM_APPEAL_ALREADY_PENDING: 'ITEM_APPEAL_ALREADY_PENDING',
  ITEM_APPEAL_LIMIT_REACHED: 'ITEM_APPEAL_LIMIT_REACHED',
  ITEM_APPEAL_NOT_PENDING: 'ITEM_APPEAL_NOT_PENDING',
  ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED: 'ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED',
  ITEM_ACTION_NOT_ALLOWED_FOR_CATEGORY: 'ITEM_ACTION_NOT_ALLOWED_FOR_CATEGORY',
  ITEM_APPEAL_REASON_LENGTH: 'ITEM_APPEAL_REASON_LENGTH',
  ITEM_APPEAL_EVIDENCE_LIMIT: 'ITEM_APPEAL_EVIDENCE_LIMIT',
  ITEM_APPEAL_EVIDENCE_TYPE_UNSUPPORTED: 'ITEM_APPEAL_EVIDENCE_TYPE_UNSUPPORTED',
  ITEM_APPEAL_EVIDENCE_TOO_LARGE: 'ITEM_APPEAL_EVIDENCE_TOO_LARGE',
  ITEM_APPEAL_EVIDENCE_URL_INVALID: 'ITEM_APPEAL_EVIDENCE_URL_INVALID',
  ITEM_WEAR_NOTE_REQUIRED: 'ITEM_WEAR_NOTE_REQUIRED',
  ITEM_WEAR_NOTE_LENGTH: 'ITEM_WEAR_NOTE_LENGTH',
  ITEM_APPEAL_UPHOLD_NOTE_REQUIRED: 'ITEM_APPEAL_UPHOLD_NOTE_REQUIRED',
  ITEM_APPEAL_SELF_REVIEW_BLOCKED: 'ITEM_APPEAL_SELF_REVIEW_BLOCKED',
  ITEM_REJECTION_CATEGORY_REQUIRED: 'ITEM_REJECTION_CATEGORY_REQUIRED',
  INSUFFICIENT_AI_TOKENS: 'INSUFFICIENT_AI_TOKENS',
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

export const RECOVERY_ACTIONS: readonly RecoveryAction[] = [
  'ai_fix',
  'retake',
  'condition',
  'resubmit',
  'appeal',
];

export const APPEAL_REASON_MIN = 20;
export const APPEAL_REASON_MAX = 500;
export const APPEAL_EVIDENCE_MAX = 3;
/** Matches `APPEAL_EVIDENCE_MAX_BYTES` in apps/backend/src/item-appeals/appeal-evidence.ts. */
export const APPEAL_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const APPEAL_EVIDENCE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const APPEAL_EVIDENCE_ACCEPT = APPEAL_EVIDENCE_CONTENT_TYPES.join(',');
export const WEAR_NOTE_MIN = 10;
export const WEAR_NOTE_MAX = 300;
export const DEFAULT_CLEANUP_TOKEN_COST = 1;
export const DEFAULT_APPEAL_LIMIT = 1;
export const DEFAULT_APPEAL_SLA_HOURS = 48;
export const REVIEW_SLA_HOURS = 24;
