import {
  APPEAL_EVIDENCE_CONTENT_TYPES,
  APPEAL_EVIDENCE_MAX,
  APPEAL_EVIDENCE_MAX_BYTES,
  APPEAL_REASON_MAX,
  APPEAL_REASON_MIN,
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
  type ItemRejectionRecovery,
  type RecoveryAction,
  type RecoveryChipPresentation,
  type RecoveryErrorCode,
  type RecoveryTileId,
  type RejectionCategory,
  type ResubmitEditLink,
  type SlaState,
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

export function isInReviewStatus(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'ai_reviewing';
}

export function shouldShowRecoveryCard(
  recovery: ItemRejectionRecovery | null | undefined,
  pendingResubmit = false
): boolean {
  if (!recovery) return false;
  if (pendingResubmit || recovery.item.statusDisplay === 'in_review') return true;
  if (recovery.item.moderationStatus === 'rejected') return true;
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
  statusDisplay?: string | null;
  pendingResubmit?: boolean;
}): RecoveryChipPresentation {
  if (input.pendingResubmit || input.statusDisplay === 'in_review') {
    return inReviewChip();
  }
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

function rejectedChip(category?: string | null): RecoveryChipPresentation {
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
  if (!trimmed) return wearError('required', 'Describe the wear');
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
  const suffix = kind[0].toUpperCase() + kind.slice(1);
  return {
    valid: false,
    errorKey: `business.items.recovery.condition.wear${suffix}`,
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

export function normalizeEvidenceContentType(
  type?: string | null,
  name?: string | null
): string {
  const raw = (type ?? '').toLowerCase().split(';')[0].trim();
  if (raw === 'image/jpg') return 'image/jpeg';
  if (raw) return raw;
  const ext = (name ?? '').toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return raw;
}

export function isAllowedEvidenceFile(file: {
  type?: string | null;
  name?: string | null;
  size?: number | null;
}): boolean {
  const type = normalizeEvidenceContentType(file.type, file.name);
  const name = (file.name ?? '').toLowerCase();
  if (type === 'image/svg+xml' || name.endsWith('.svg') || name.endsWith('.pdf')) {
    return false;
  }
  const allowed = (APPEAL_EVIDENCE_CONTENT_TYPES as readonly string[]).includes(type);
  if (!allowed) return false;
  if (file.size == null) return true;
  return Number.isInteger(file.size) && file.size > 0 && file.size <= APPEAL_EVIDENCE_MAX_BYTES;
}

export function validateAppealEvidence(
  files: Array<{ type?: string | null; name?: string | null; size?: number | null }>
): AppealEvidenceValidation {
  if (files.length > APPEAL_EVIDENCE_MAX) {
    return {
      valid: false,
      errorKey: 'business.items.recovery.appeal.evidenceLimit',
      defaultMessage: `Add up to ${APPEAL_EVIDENCE_MAX} files`,
    };
  }
  if (files.some((file) => !isAllowedEvidenceFile(file))) {
    const tooLarge = files.some(
      (file) =>
        file.size != null &&
        (file.size <= 0 || file.size > APPEAL_EVIDENCE_MAX_BYTES)
    );
    return {
      valid: false,
      errorKey: tooLarge
        ? 'business.items.recovery.appeal.evidenceTooLarge'
        : 'business.items.recovery.appeal.evidenceType',
      defaultMessage: tooLarge
        ? 'Photos must be 5 MB or smaller'
        : 'Use a JPEG, PNG or WebP photo',
    };
  }
  return { valid: true };
}

export function getAppealTileDisabledReason(input: {
  canAppeal: boolean;
  pendingResubmit: boolean;
  appealsUsed: number;
  appealLimit: number;
  appealStatus?: string | null;
}): AppealTileDisabledReason {
  if (input.pendingResubmit) return 'in_review';
  if (input.appealStatus === 'pending') return 'in_review';
  if (input.canAppeal) return null;
  if (input.appealsUsed >= input.appealLimit) return 'allowance_used';
  if (input.appealStatus === 'upheld' || input.appealStatus === 'overturned') {
    return 'allowance_used';
  }
  return 'not_allowed';
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
  return null;
}

export function isInsufficientTokensError(error: unknown): boolean {
  return extractRecoveryErrorCode(error) === RECOVERY_ERROR_CODES.INSUFFICIENT_AI_TOKENS;
}

export function isCategoryRequiredError(error: unknown): boolean {
  return (
    extractRecoveryErrorCode(error) ===
    RECOVERY_ERROR_CODES.ITEM_REJECTION_CATEGORY_REQUIRED
  );
}

export function isWithdrawConfirmRequired(error: unknown): boolean {
  return (
    extractRecoveryErrorCode(error) ===
    RECOVERY_ERROR_CODES.ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED
  );
}

export type AppealConfirmSaveResult<T> =
  | { ok: true; data: T }
  | { ok: false; cancelled: true };

export async function saveItemWithAppealConfirm<T>(
  save: (confirmWithdrawAppeal?: boolean) => Promise<T>,
  confirmWithdraw: () => boolean | Promise<boolean>
): Promise<AppealConfirmSaveResult<T>> {
  try {
    return { ok: true, data: await save() };
  } catch (error: unknown) {
    if (!isWithdrawConfirmRequired(error)) throw error;
    if (!(await confirmWithdraw())) return { ok: false, cancelled: true };
    return { ok: true, data: await save(true) };
  }
}

export function recoveryErrorI18n(code: RecoveryErrorCode | null): {
  key: string;
  defaultValue: string;
} {
  return RECOVERY_ERROR_COPY[code ?? ''] ?? {
    key: 'business.items.recovery.errors.generic',
    defaultValue: 'This action could not be completed.',
  };
}

const RECOVERY_ERROR_COPY: Record<string, { key: string; defaultValue: string }> = {
  ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED: {
    key: 'business.items.recovery.appeal.withdrawWarn',
    defaultValue: 'Resubmitting will withdraw your pending appeal.',
  },
  ITEM_APPEAL_LIMIT_REACHED: {
    key: 'business.items.recovery.appeal.disabledAllowance',
    defaultValue: '1 appeal per decision',
  },
  ITEM_RESUBMIT_PENDING: {
    key: 'business.items.recovery.appeal.disabledInReview',
    defaultValue: 'In review',
  },
  INSUFFICIENT_AI_TOKENS: {
    key: 'business.items.recovery.aiFix.buy',
    defaultValue: 'Buy tokens',
  },
  ITEM_REJECTION_CATEGORY_REQUIRED: {
    key: 'admin.itemModeration.categoryRequired',
    defaultValue: 'Choose a rejection category.',
  },
  ITEM_APPEAL_UPHOLD_NOTE_REQUIRED: {
    key: 'admin.itemAppeals.upholdNoteRequired',
    defaultValue: 'A note is required to uphold this decision.',
  },
  ITEM_APPEAL_SELF_REVIEW_BLOCKED: {
    key: 'admin.itemAppeals.selfReviewBlocked',
    defaultValue: 'Another moderator must review an appeal of your own decision.',
  },
  ITEM_WEAR_NOTE_REQUIRED: {
    key: 'business.items.recovery.condition.wearRequired',
    defaultValue: 'Describe the wear',
  },
  ITEM_APPEAL_EVIDENCE_TYPE_UNSUPPORTED: {
    key: 'business.items.recovery.appeal.evidenceType',
    defaultValue: 'Use a JPEG, PNG or WebP photo',
  },
  ITEM_APPEAL_EVIDENCE_TOO_LARGE: {
    key: 'business.items.recovery.appeal.evidenceTooLarge',
    defaultValue: 'Photos must be 5 MB or smaller',
  },
  ITEM_APPEAL_EVIDENCE_URL_INVALID: {
    key: 'business.items.recovery.appeal.evidenceUrlInvalid',
    defaultValue: 'That evidence file could not be used. Upload it again.',
  },
};

export function usedFlagFromCondition(condition: ItemCondition): boolean {
  return condition === 'used' || condition === 'refurbished';
}

export type VisibleRecoveryTileId = Exclude<RecoveryTileId, 'resubmit'>;

export function visibleRecoveryTiles(
  actions: RecoveryAction[],
  resubmitEditLink: ResubmitEditLink
): VisibleRecoveryTileId[] {
  const tiles: VisibleRecoveryTileId[] = [];
  for (const action of actions) {
    if (action !== 'resubmit') tiles.push(action);
  }
  if (resubmitEditLink === 'fields') insertBeforeAppeal(tiles, 'edit_fields');
  if (resubmitEditLink === 'price') insertBeforeAppeal(tiles, 'edit_price');
  return tiles;
}

function insertBeforeAppeal(
  tiles: VisibleRecoveryTileId[],
  extra: VisibleRecoveryTileId
) {
  if (tiles.includes(extra)) return;
  const appealAt = tiles.indexOf('appeal');
  if (appealAt === -1) {
    tiles.push(extra);
    return;
  }
  tiles.splice(appealAt, 0, extra);
}

export function unwrapApiData<T>(body: { success?: boolean; data?: T } | T): T {
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
    return body.data as T;
  }
  return body as T;
}

export function slaBadgeTone(
  state: SlaState | null | undefined
): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'breached') return 'error';
  if (state === 'warning') return 'warning';
  if (state === 'ok') return 'success';
  return 'default';
}

export function recoveryDeepLinkItemId(
  data: Record<string, unknown> | undefined
): string | null {
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
