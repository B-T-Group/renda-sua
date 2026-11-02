import {
  categoryDefaultLabel,
  categoryLabelKey,
  cleanupTokenCost,
  extractRecoveryErrorCode,
  getAppealTileDisabledReason,
  getRecoveryChipPresentation,
  isAllowedEvidenceFile,
  isAlteredCleanup,
  isCategoryRequiredError,
  isInsufficientTokensError,
  isNotAllowedCategory,
  isResubmitEnabled,
  needsToBuyTokens,
  parseRejectionCategory,
  recoveryErrorI18n,
  shouldConfirmResubmitWithoutChanges,
  shouldShowRecoveryCard,
  shouldWarnAppealWithdraw,
  slaBadgeTone,
  usedFlagFromCondition,
  validateAppealEvidence,
  validateAppealReason,
  validateWearNote,
  visibleRecoveryTiles,
} from './itemRejectionRecovery';
import {
  APPEAL_EVIDENCE_IMAGE_MAX_BYTES,
  APPEAL_EVIDENCE_PDF_MAX_BYTES,
  type ItemRejectionRecovery,
} from '../types/itemRejectionRecovery';

function rejectedRecovery(
  overrides: Partial<ItemRejectionRecovery> = {}
): ItemRejectionRecovery {
  return {
    item: {
      id: 'item-1',
      name: 'Lamp',
      moderationStatus: 'rejected',
      statusDisplay: 'needs_changes',
      condition: 'new',
      wearNote: null,
    },
    rejection: {
      id: 'rej-1',
      category: 'photo_quality',
      reason: 'Blurry photos',
      source: 'admin',
      decidedBy: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    actions: ['ai_fix', 'retake', 'resubmit', 'appeal'],
    resubmitEditLink: null,
    appeal: null,
    appealsUsed: 0,
    appealLimit: 1,
    canAppeal: true,
    canResubmit: true,
    resubmitWithdrawsAppeal: false,
    aiCleanup: { costPerImage: 1, tokenBalance: 4, tokensSpentOnItem: 0 },
    reviewSlaHours: 24,
    appealSlaHours: 48,
    ...overrides,
  };
}

describe('chip presentation', () => {
  it('shows Needs changes in amber for typical rejections', () => {
    const chip = getRecoveryChipPresentation({
      status: 'rejected',
      category: 'photo_quality',
    });
    expect(chip.tone).toBe('warning');
    expect(chip.defaultLabel).toBe('Needs changes');
    expect(chip.labelKey).toBe('business.items.recovery.status.needsChanges');
  });

  it('shows Not allowed in red for prohibited and counterfeit', () => {
    expect(
      getRecoveryChipPresentation({
        status: 'rejected',
        category: 'prohibited_item',
      }).defaultLabel
    ).toBe('Not allowed');
    expect(
      getRecoveryChipPresentation({
        status: 'rejected',
        category: 'counterfeit',
      }).tone
    ).toBe('error');
  });

  it('shows In review after resubmit', () => {
    const chip = getRecoveryChipPresentation({
      status: 'pending',
      pendingResubmit: true,
    });
    expect(chip.defaultLabel).toBe('In review · usually within 24 h');
  });

  it('shows In review from server statusDisplay after resubmit', () => {
    const chip = getRecoveryChipPresentation({
      status: 'pending',
      statusDisplay: 'in_review',
    });
    expect(chip.tone).toBe('warning');
    expect(chip.defaultLabel).toBe('In review · usually within 24 h');
    expect(chip.labelKey).toBe('business.items.recovery.status.inReview');
    expect(
      shouldShowRecoveryCard(
        rejectedRecovery({
          item: {
            id: 'item-1',
            name: 'Lamp',
            moderationStatus: 'pending',
            statusDisplay: 'in_review',
            condition: 'new',
            wearNote: null,
          },
          rejection: null,
          actions: [],
          canResubmit: false,
        })
      )
    ).toBe(true);
  });
});

describe('validations', () => {
  it('requires a 10–300 character wear note for used and refurbished', () => {
    expect(validateWearNote('new', '')).toEqual({ valid: true });
    expect(validateWearNote('used', '').valid).toBe(false);
    expect(validateWearNote('refurbished', 'short').valid).toBe(false);
    expect(validateWearNote('used', 'Visible scuff on the left corner').valid).toBe(
      true
    );
  });

  it('requires a 20–500 character appeal reason', () => {
    expect(validateAppealReason('too short').valid).toBe(false);
    expect(
      validateAppealReason('This listing is accurate and should be live.').valid
    ).toBe(true);
  });

  it('allows up to 3 images or PDFs as evidence', () => {
    expect(validateAppealEvidence([{ type: 'image/png', name: 'a.png' }]).valid).toBe(
      true
    );
    expect(
      validateAppealEvidence([
        { type: 'image/png', name: 'a.png' },
        { type: 'image/png', name: 'b.png' },
        { type: 'image/png', name: 'c.png' },
        { type: 'image/png', name: 'd.png' },
      ]).valid
    ).toBe(false);
  });

  it('rejects SVG evidence and files over the AWS presign caps', () => {
    // AwsController.MAX_IMAGE_SIZE_BYTES = 10MB; MAX_DOCUMENT_SIZE_BYTES = 50MB.
    // Image presign also rejects SVG (jpeg/jpg/png/webp only).
    expect(isAllowedEvidenceFile({ type: 'image/svg+xml', name: 'logo.svg' })).toBe(
      false
    );
    expect(isAllowedEvidenceFile({ type: 'image/png', name: 'logo.svg' })).toBe(false);
    expect(
      isAllowedEvidenceFile({
        type: 'image/jpeg',
        name: 'photo.jpg',
        size: APPEAL_EVIDENCE_IMAGE_MAX_BYTES + 1,
      })
    ).toBe(false);
    expect(
      isAllowedEvidenceFile({
        type: 'application/pdf',
        name: 'receipt.pdf',
        size: APPEAL_EVIDENCE_PDF_MAX_BYTES + 1,
      })
    ).toBe(false);
    expect(
      isAllowedEvidenceFile({
        type: 'image/webp',
        name: 'photo.webp',
        size: APPEAL_EVIDENCE_IMAGE_MAX_BYTES,
      })
    ).toBe(true);
    expect(
      isAllowedEvidenceFile({
        type: 'application/pdf',
        name: 'receipt.pdf',
        size: APPEAL_EVIDENCE_PDF_MAX_BYTES,
      })
    ).toBe(true);
  });
});

describe('appeal tile and resubmit gates', () => {
  it('disables appeal while a resubmit is in review', () => {
    expect(
      getAppealTileDisabledReason({
        canAppeal: true,
        pendingResubmit: true,
        appealsUsed: 0,
        appealLimit: 1,
      })
    ).toBe('in_review');
  });

  it('disables appeal when the allowance is used', () => {
    expect(
      getAppealTileDisabledReason({
        canAppeal: false,
        pendingResubmit: false,
        appealsUsed: 1,
        appealLimit: 1,
        appealStatus: 'upheld',
      })
    ).toBe('allowance_used');
  });

  it('locks resubmit after submit and warns before withdrawing an appeal', () => {
    expect(isResubmitEnabled({ allowed: true, locked: true })).toBe(false);
    expect(shouldWarnAppealWithdraw('pending')).toBe(true);
    expect(shouldConfirmResubmitWithoutChanges(false)).toBe(true);
  });
});

describe('cleanup helpers', () => {
  it('computes token cost and buy-tokens gate', () => {
    expect(cleanupTokenCost(3, 1)).toBe(3);
    expect(needsToBuyTokens(3, 2)).toBe(true);
  });

  it('treats confidence_check altered as discard-default', () => {
    expect(isAlteredCleanup({ confidence_check: 'altered' })).toBe(true);
    expect(isAlteredCleanup({ changes: [] })).toBe(false);
  });
});

describe('error mapping', () => {
  it('reads coded 409 bodies from axios-shaped errors', () => {
    expect(
      extractRecoveryErrorCode({
        response: { data: { code: 'INSUFFICIENT_AI_TOKENS' } },
      })
    ).toBe('INSUFFICIENT_AI_TOKENS');
    expect(
      isInsufficientTokensError({
        response: { data: { code: 'INSUFFICIENT_AI_TOKENS' } },
      })
    ).toBe(true);
    expect(
      isCategoryRequiredError({
        response: { data: { code: 'ITEM_REJECTION_CATEGORY_REQUIRED' } },
      })
    ).toBe(true);
    expect(
      recoveryErrorI18n('ITEM_REJECTION_CATEGORY_REQUIRED').key
    ).toBe('admin.itemModeration.categoryRequired');
  });
});

describe('recovery card and tiles', () => {
  it('shows the card for a rejected item and pending appeal', () => {
    expect(shouldShowRecoveryCard(rejectedRecovery())).toBe(true);
    expect(
      shouldShowRecoveryCard(
        rejectedRecovery({
          item: {
            id: 'item-1',
            name: 'Lamp',
            moderationStatus: 'pending',
            statusDisplay: 'in_review',
            condition: 'new',
            wearNote: null,
          },
          rejection: null,
          actions: [],
          canResubmit: false,
        }),
        true
      )
    ).toBe(true);
  });

  it('orders visible tiles from server actions plus the edit link', () => {
    expect(
      visibleRecoveryTiles(['ai_fix', 'retake', 'resubmit', 'appeal'], null)
    ).toEqual(['ai_fix', 'retake', 'appeal']);
    expect(visibleRecoveryTiles(['resubmit', 'appeal'], 'price')).toEqual([
      'edit_price',
      'appeal',
    ]);
    expect(visibleRecoveryTiles(['resubmit', 'appeal'], 'fields')).toEqual([
      'edit_fields',
      'appeal',
    ]);
  });

  it('parses categories and SLA tones', () => {
    expect(parseRejectionCategory('pricing')).toBe('pricing');
    expect(parseRejectionCategory('nope')).toBe('other');
    expect(isNotAllowedCategory('counterfeit')).toBe(true);
    expect(usedFlagFromCondition('refurbished')).toBe(true);
    expect(slaBadgeTone('breached')).toBe('error');
    expect(slaBadgeTone('warning')).toBe('warning');
    expect(categoryLabelKey('photo_quality')).toBe(
      'business.items.recovery.cat.photo_quality'
    );
    expect(categoryDefaultLabel('counterfeit')).toBe('Possible counterfeit');
  });
});
