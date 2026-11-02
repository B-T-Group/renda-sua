import {
  APPEAL_EVIDENCE_MAX,
  APPEAL_REASON_MAX,
  APPEAL_REASON_MIN,
  DEFAULT_APPEAL_LIMIT,
  DEFAULT_CLEANUP_TOKEN_COST,
  NOT_ALLOWED_CATEGORIES,
  RECOVERY_ERROR_CODES,
  WEAR_NOTE_MAX,
  WEAR_NOTE_MIN,
  type AppealEvidenceValidation,
  type AppealReasonValidation,
  type AppealTileDisabledReason,
  type ItemAppeal,
  type ItemCondition,
  type ItemRejection,
  type ItemRejectionRecovery,
  type RecoveryChipPresentation,
  type RecoveryErrorCode,
  type RecoveryItemSnapshot,
  type RejectionAllowedActions,
  type RejectionCategory,
  type WearNoteValidation,
} from '../types/itemRejectionRecovery';

export function isRejectionCategory(
  value: string | null | undefined
): value is RejectionCategory {
  return (
    value === 'photo_quality' ||
    value === 'prohibited_item' ||
    value === 'counterfeit' ||
    value === 'wrong_condition' ||
    value === 'missing_info' ||
    value === 'pricing' ||
    value === 'other'
  );
}

export function isNotAllowedCategory(
  category: string | null | undefined
): boolean {
  return NOT_ALLOWED_CATEGORIES.includes(category as RejectionCategory);
}

export function parseRejectionCategory(
  value: string | null | undefined
): RejectionCategory {
  return isRejectionCategory(value) ? value : 'other';
}

/** Server is source of truth; this map is only used when the API omits actions. */
export function fallbackAllowedActions(
  category: RejectionCategory
): RejectionAllowedActions {
  if (category === 'prohibited_item' || category === 'counterfeit') {
    return appealOnlyActions();
  }
  return actionsForRecoverableCategory(category);
}

function appealOnlyActions(): RejectionAllowedActions {
  return {
    aiFix: false,
    retake: false,
    condition: false,
    resubmit: false,
    appeal: true,
  };
}

function actionsForRecoverableCategory(
  category: RejectionCategory
): RejectionAllowedActions {
  return {
    aiFix: category === 'photo_quality' || category === 'other',
    retake: category !== 'pricing',
    condition: category !== 'photo_quality' && category !== 'pricing',
    resubmit: true,
    appeal: true,
    editFields: category === 'missing_info',
    editPrice: category === 'pricing',
  };
}

export function isInReviewStatus(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'ai_reviewing';
}

export function shouldShowRecoveryCard(
  recovery: ItemRejectionRecovery | null | undefined
): boolean {
  if (!recovery) return false;
  if (recovery.moderation_status === 'rejected') return true;
  if (recovery.pending_resubmit) return true;
  return isVisibleAppeal(recovery.appeal);
}

function isVisibleAppeal(appeal: ItemAppeal | null | undefined): boolean {
  if (!appeal) return false;
  return (
    appeal.status === 'pending' ||
    appeal.status === 'upheld' ||
    appeal.status === 'overturned'
  );
}

export function getRecoveryChipPresentation(input: {
  status?: string | null;
  category?: string | null;
  pendingResubmit?: boolean;
}): RecoveryChipPresentation {
  if (input.pendingResubmit) return inReviewChip();
  if (input.status === 'rejected') return rejectedChip(input.category);
  return defaultChip(input.status);
}

function inReviewChip(): RecoveryChipPresentation {
  return {
    tone: 'warning',
    labelKey: 'business.items.recovery.status.inReview',
    defaultLabel: 'In review · usually within 24 h',
  };
}

function rejectedChip(
  category?: string | null
): RecoveryChipPresentation {
  if (isNotAllowedCategory(category)) {
    return {
      tone: 'error',
      labelKey: 'business.items.recovery.status.notAllowed',
      defaultLabel: 'Not allowed',
    };
  }
  return {
    tone: 'warning',
    labelKey: 'business.items.recovery.status.needsChanges',
    defaultLabel: 'Needs changes',
  };
}

function defaultChip(status?: string | null): RecoveryChipPresentation {
  if (status === 'approved') {
    return {
      tone: 'success',
      labelKey: 'business.items.moderation.approved',
      defaultLabel: 'Live',
    };
  }
  if (status === 'draft') {
    return {
      tone: 'default',
      labelKey: 'business.items.moderation.draft',
      defaultLabel: 'Draft',
    };
  }
  if (status === 'proposal_pending') {
    return {
      tone: 'info',
      labelKey: 'business.items.moderation.proposalPending',
      defaultLabel: 'AI suggestions ready',
    };
  }
  if (status === 'ai_reviewing') {
    return {
      tone: 'warning',
      labelKey: 'business.items.moderation.aiReviewing',
      defaultLabel: 'AI reviewing',
    };
  }
  return {
    tone: 'warning',
    labelKey: 'business.items.moderation.pending',
    defaultLabel: 'Pending approval',
  };
}

export function categoryLabelKey(category: RejectionCategory): string {
  return `business.items.recovery.cat.${category}`;
}

export function categoryDefaultLabel(category: RejectionCategory): string {
  const labels: Record<RejectionCategory, string> = {
    photo_quality: 'Photo quality',
    prohibited_item: 'Prohibited item',
    counterfeit: 'Possible counterfeit',
    wrong_condition: 'Wrong condition',
    missing_info: 'Missing info',
    pricing: 'Pricing',
    other: 'Other',
  };
  return labels[category];
}

export function validateWearNote(
  condition: ItemCondition,
  note: string | null | undefined
): WearNoteValidation {
  if (condition === 'new') return { valid: true };
  const trimmed = (note ?? '').trim();
  if (!trimmed) {
    return wearError('required', 'Describe the wear');
  }
  if (trimmed.length < WEAR_NOTE_MIN) {
    return wearError('tooShort', `Use at least ${WEAR_NOTE_MIN} characters`);
  }
  if (trimmed.length > WEAR_NOTE_MAX) {
    return wearError('tooLong', `Use at most ${WEAR_NOTE_MAX} characters`);
  }
  return { valid: true };
}

function wearError(
  kind: 'required' | 'tooShort' | 'tooLong',
  defaultMessage: string
): WearNoteValidation {
  return {
    valid: false,
    errorKey: `business.items.recovery.condition.wear${kind[0].toUpperCase()}${kind.slice(1)}`,
    defaultMessage,
  };
}

export function validateAppealReason(
  reason: string | null | undefined
): AppealReasonValidation {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < APPEAL_REASON_MIN) {
    return {
      valid: false,
      errorKey: 'business.items.recovery.appeal.reasonTooShort',
      defaultMessage: `Use at least ${APPEAL_REASON_MIN} characters`,
    };
  }
  if (trimmed.length > APPEAL_REASON_MAX) {
    return {
      valid: false,
      errorKey: 'business.items.recovery.appeal.reasonTooLong',
      defaultMessage: `Use at most ${APPEAL_REASON_MAX} characters`,
    };
  }
  return { valid: true };
}

export function isAllowedEvidenceFile(file: {
  type?: string | null;
  name?: string | null;
}): boolean {
  const type = (file.type ?? '').toLowerCase();
  const name = (file.name ?? '').toLowerCase();
  if (type.startsWith('image/')) return true;
  if (type === 'application/pdf' || name.endsWith('.pdf')) return true;
  return false;
}

export function validateAppealEvidence(
  files: Array<{ type?: string | null; name?: string | null }>
): AppealEvidenceValidation {
  if (files.length > APPEAL_EVIDENCE_MAX) {
    return {
      valid: false,
      errorKey: 'business.items.recovery.appeal.evidenceLimit',
      defaultMessage: `Add up to ${APPEAL_EVIDENCE_MAX} files`,
    };
  }
  if (files.some((file) => !isAllowedEvidenceFile(file))) {
    return {
      valid: false,
      errorKey: 'business.items.recovery.appeal.evidenceType',
      defaultMessage: 'Use images or a PDF',
    };
  }
  return { valid: true };
}

export function getAppealTileDisabledReason(input: {
  allowed: boolean;
  pendingResubmit: boolean;
  allowanceRemaining: number;
  appealStatus?: string | null;
}): AppealTileDisabledReason {
  if (!input.allowed) return 'not_allowed';
  if (input.pendingResubmit) return 'in_review';
  if (input.appealStatus === 'pending') return 'in_review';
  if (input.allowanceRemaining <= 0) return 'allowance_used';
  if (input.appealStatus === 'upheld' || input.appealStatus === 'overturned') {
    return 'allowance_used';
  }
  return null;
}

export function isResubmitEnabled(input: {
  allowed: boolean;
  locked: boolean;
}): boolean {
  return input.allowed && !input.locked;
}

export function shouldConfirmResubmitWithoutChanges(hasChanges: boolean): boolean {
  return !hasChanges;
}

export function shouldWarnAppealWithdraw(
  appealStatus: string | null | undefined
): boolean {
  return appealStatus === 'pending';
}

export function cleanupTokenCost(imageCount: number, costPerImage: number): number {
  const safeCount = Math.max(0, imageCount);
  const safeCost = costPerImage > 0 ? costPerImage : DEFAULT_CLEANUP_TOKEN_COST;
  return safeCount * safeCost;
}

export function needsToBuyTokens(cost: number, balance: number): boolean {
  return cost > balance;
}

export function isAlteredCleanup(result: {
  confidence_check?: string | null;
  confidence_tier?: string | null;
  changes?: string[] | null;
}): boolean {
  if (result.confidence_check === 'altered') return true;
  return (result.changes ?? []).includes('altered');
}

export function extractRecoveryErrorCode(error: unknown): RecoveryErrorCode | null {
  const raw = readErrorCode(error);
  if (!raw) return null;
  const codes = Object.values(RECOVERY_ERROR_CODES) as string[];
  return codes.includes(raw) ? (raw as RecoveryErrorCode) : null;
}

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const record = error as Record<string, unknown>;
  if (typeof record.code === 'string') return record.code;
  const response = record.response as { data?: Record<string, unknown> } | undefined;
  const data = response?.data ?? (record.data as Record<string, unknown> | undefined);
  if (data && typeof data.code === 'string') return data.code;
  if (data && typeof data.error === 'string') return data.error;
  return null;
}

export function isInsufficientTokensError(error: unknown): boolean {
  return extractRecoveryErrorCode(error) === RECOVERY_ERROR_CODES.INSUFFICIENT_TOKENS;
}

export function isNotFoundStatus(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  if (record.status === 404) return true;
  const response = record.response as { status?: number } | undefined;
  return response?.status === 404;
}

export function buildLocalRejection(
  item: RecoveryItemSnapshot
): ItemRejection | null {
  if (!item.rejection_reason && !item.rejection_category && !item.current_rejection) {
    if (item.moderation_status !== 'rejected') return null;
  }
  if (item.current_rejection) return item.current_rejection;
  if (item.moderation_status !== 'rejected' && !item.rejection_reason) return null;
  return {
    id: `local-${item.id}`,
    item_id: item.id,
    category: parseRejectionCategory(item.rejection_category),
    reason: item.rejection_reason ?? '',
    created_at: item.updated_at ?? new Date(0).toISOString(),
  };
}

export function synthesizeRecoveryFromItem(
  item: RecoveryItemSnapshot
): ItemRejectionRecovery {
  const rejection = buildLocalRejection(item);
  const category = rejection?.category ?? parseRejectionCategory(item.rejection_category);
  const pendingResubmit =
    isInReviewStatus(item.moderation_status) && Boolean(rejection);
  return {
    item_id: item.id,
    moderation_status: item.moderation_status ?? 'pending',
    rejection,
    allowed_actions: item.allowed_recovery_actions ?? fallbackAllowedActions(category),
    appeal: item.current_appeal ?? null,
    appeal_history: item.appeal_history ?? [],
    appeal_allowance_remaining:
      item.appeal_allowance_remaining ?? DEFAULT_APPEAL_LIMIT,
    tokens_used_on_item: item.tokens_used_on_item ?? 0,
    ai_tokens: item.ai_tokens ?? 0,
    cleanup_token_cost: item.cleanup_token_cost ?? DEFAULT_CLEANUP_TOKEN_COST,
    condition: item.condition ?? (item.is_used ? 'used' : 'new'),
    wear_note: item.wear_note ?? null,
    pending_resubmit: pendingResubmit,
    translation_available: item.translation_available ?? false,
  };
}

export function mergeRecoveryPayload(
  payload: ItemRejectionRecovery,
  snapshot?: RecoveryItemSnapshot | null
): ItemRejectionRecovery {
  if (!snapshot) return normalizeRecovery(payload);
  const merged = {
    ...synthesizeRecoveryFromItem(snapshot),
    ...payload,
    allowed_actions: payload.allowed_actions,
    rejection: payload.rejection ?? buildLocalRejection(snapshot),
  };
  return normalizeRecovery(merged);
}

function normalizeRecovery(payload: ItemRejectionRecovery): ItemRejectionRecovery {
  const category = payload.rejection
    ? parseRejectionCategory(payload.rejection.category)
    : 'other';
  return {
    ...payload,
    allowed_actions: payload.allowed_actions ?? fallbackAllowedActions(category),
    appeal_history: payload.appeal_history ?? [],
    tokens_used_on_item: payload.tokens_used_on_item ?? 0,
    cleanup_token_cost: payload.cleanup_token_cost ?? DEFAULT_CLEANUP_TOKEN_COST,
    pending_resubmit: Boolean(payload.pending_resubmit),
  };
}

export function visibleRecoveryActions(
  actions: RejectionAllowedActions
): Array<keyof RejectionAllowedActions> {
  const order: Array<keyof RejectionAllowedActions> = [
    'aiFix',
    'retake',
    'condition',
    'editFields',
    'editPrice',
    'appeal',
  ];
  return order.filter((key) => Boolean(actions[key]));
}

export function conditionFromUsedFlag(isUsed: boolean | null | undefined): ItemCondition {
  return isUsed ? 'used' : 'new';
}

export function usedFlagFromCondition(condition: ItemCondition): boolean {
  return condition === 'used' || condition === 'refurbished';
}

export function unwrapApiData<T>(body: { success?: boolean; data?: T } | T): T {
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
    return body.data as T;
  }
  return body as T;
}

export function recoveryDeepLinkItemId(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const keys = ['itemId', 'item_id', 'entity_id', 'entityId'];
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

export function isItemRecoveryPushType(type: string | null | undefined): boolean {
  if (!type) return false;
  return (
    type === 'business_items_rejected' ||
    type === 'item_appeal_received' ||
    type === 'item_appeal_decided' ||
    type === 'item_resubmit_decided' ||
    type === 'ITEM_REJECTED' ||
    type === 'ITEM_APPEAL_RECEIVED' ||
    type === 'ITEM_APPEAL_DECIDED' ||
    type === 'ITEM_RESUBMIT_DECIDED'
  );
}
