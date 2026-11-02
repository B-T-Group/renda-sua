import { ITEM_REJECTION_RECOVERY_GQL_FIELDS } from '../types/itemRejectionRecovery';
import {
  buildLocalRejection,
  categoryDefaultLabel,
  categoryLabelKey,
  cleanupTokenCost,
  extractRecoveryErrorCode,
  fallbackAllowedActions,
  getAppealTileDisabledReason,
  getRecoveryChipPresentation,
  isAlteredCleanup,
  isAllowedEvidenceFile,
  isInReviewStatus,
  isInsufficientTokensError,
  isNotAllowedCategory,
  isNotFoundStatus,
  isResubmitEnabled,
  mergeRecoveryPayload,
  needsToBuyTokens,
  parseRejectionCategory,
  shouldConfirmResubmitWithoutChanges,
  shouldShowRecoveryCard,
  shouldWarnAppealWithdraw,
  synthesizeRecoveryFromItem,
  usedFlagFromCondition,
  validateAppealEvidence,
  validateAppealReason,
  validateWearNote,
  visibleRecoveryActions,
} from './itemRejectionRecovery';

describe('fallbackAllowedActions', () => {
  it('allows only appeal for prohibited and counterfeit', () => {
    for (const category of ['prohibited_item', 'counterfeit'] as const) {
      expect(fallbackAllowedActions(category)).toEqual({
        aiFix: false,
        retake: false,
        condition: false,
        resubmit: false,
        appeal: true,
      });
    }
  });

  it('matches the spec map for recoverable categories', () => {
    expect(fallbackAllowedActions('photo_quality')).toMatchObject({
      aiFix: true,
      retake: true,
      condition: false,
      resubmit: true,
      appeal: true,
    });
    expect(fallbackAllowedActions('wrong_condition')).toMatchObject({
      aiFix: false,
      retake: true,
      condition: true,
      resubmit: true,
    });
    expect(fallbackAllowedActions('missing_info')).toMatchObject({
      editFields: true,
      condition: true,
      resubmit: true,
    });
    expect(fallbackAllowedActions('pricing')).toMatchObject({
      aiFix: false,
      retake: false,
      condition: false,
      editPrice: true,
      resubmit: true,
    });
    expect(fallbackAllowedActions('other')).toMatchObject({
      aiFix: true,
      retake: true,
      condition: true,
      resubmit: true,
      appeal: true,
    });
  });
});

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

  it('defaults rejected without category to Needs changes', () => {
    expect(
      getRecoveryChipPresentation({ status: 'rejected' }).defaultLabel
    ).toBe('Needs changes');
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
    expect(validateWearNote('used', 'x'.repeat(301)).valid).toBe(false);
  });

  it('requires a 20–500 character appeal reason', () => {
    expect(validateAppealReason('too short').valid).toBe(false);
    expect(
      validateAppealReason('This listing is accurate and should be live.')
        .valid
    ).toBe(true);
    expect(validateAppealReason('x'.repeat(501)).valid).toBe(false);
  });

  it('allows up to 3 images or PDFs as evidence', () => {
    expect(isAllowedEvidenceFile({ type: 'image/jpeg', name: 'a.jpg' })).toBe(
      true
    );
    expect(isAllowedEvidenceFile({ type: 'application/pdf', name: 'a.pdf' })).toBe(
      true
    );
    expect(isAllowedEvidenceFile({ type: 'text/plain', name: 'a.txt' })).toBe(
      false
    );
    expect(
      validateAppealEvidence([
        { type: 'image/png', name: 'a.png' },
        { type: 'image/jpeg', name: 'b.jpg' },
        { type: 'application/pdf', name: 'c.pdf' },
      ]).valid
    ).toBe(true);
    expect(
      validateAppealEvidence([
        { type: 'image/png', name: 'a.png' },
        { type: 'image/png', name: 'b.png' },
        { type: 'image/png', name: 'c.png' },
        { type: 'image/png', name: 'd.png' },
      ]).valid
    ).toBe(false);
  });
});

describe('appeal tile and resubmit gates', () => {
  it('disables appeal while a resubmit is in review', () => {
    expect(
      getAppealTileDisabledReason({
        allowed: true,
        pendingResubmit: true,
        allowanceRemaining: 1,
      })
    ).toBe('in_review');
  });

  it('disables appeal when the allowance is used', () => {
    expect(
      getAppealTileDisabledReason({
        allowed: true,
        pendingResubmit: false,
        allowanceRemaining: 0,
        appealStatus: 'upheld',
      })
    ).toBe('allowance_used');
  });

  it('locks resubmit after submit and warns before withdrawing an appeal', () => {
    expect(isResubmitEnabled({ allowed: true, locked: true })).toBe(false);
    expect(shouldWarnAppealWithdraw('pending')).toBe(true);
    expect(shouldConfirmResubmitWithoutChanges(false)).toBe(true);
    expect(shouldConfirmResubmitWithoutChanges(true)).toBe(false);
  });
});

describe('cleanup helpers', () => {
  it('computes token cost and buy-tokens gate', () => {
    expect(cleanupTokenCost(3, 1)).toBe(3);
    expect(needsToBuyTokens(3, 2)).toBe(true);
    expect(needsToBuyTokens(2, 2)).toBe(false);
  });

  it('treats confidence_check altered as discard-default', () => {
    expect(isAlteredCleanup({ confidence_check: 'altered' })).toBe(true);
    expect(isAlteredCleanup({ changes: ['altered'] })).toBe(true);
    expect(isAlteredCleanup({ confidence_tier: 'high', changes: [] })).toBe(
      false
    );
  });
});

describe('error mapping', () => {
  it('reads coded 409 bodies from axios-shaped errors', () => {
    expect(
      extractRecoveryErrorCode({
        response: { data: { code: 'INSUFFICIENT_TOKENS' } },
      })
    ).toBe('INSUFFICIENT_TOKENS');
    expect(
      isInsufficientTokensError({
        response: { data: { error: 'INSUFFICIENT_TOKENS' } },
      })
    ).toBe(true);
    expect(isNotFoundStatus({ response: { status: 404 } })).toBe(true);
  });
});

describe('synthesis and merge', () => {
  it('builds a recoverable payload from a rejected item snapshot', () => {
    const recovery = synthesizeRecoveryFromItem({
      id: 'item-1',
      moderation_status: 'rejected',
      rejection_reason: 'Blurry photos',
      rejection_category: 'photo_quality',
      ai_tokens: 4,
    });
    expect(recovery.allowed_actions.aiFix).toBe(true);
    expect(recovery.rejection?.reason).toBe('Blurry photos');
    expect(shouldShowRecoveryCard(recovery)).toBe(true);
  });

  it('prefers server allowed_actions over the fallback map', () => {
    const merged = mergeRecoveryPayload({
      item_id: 'item-1',
      moderation_status: 'rejected',
      rejection: {
        id: 'rej-1',
        item_id: 'item-1',
        category: 'other',
        reason: 'Check photos',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      allowed_actions: {
        aiFix: false,
        retake: false,
        condition: false,
        resubmit: false,
        appeal: true,
      },
      appeal: null,
      appeal_history: [],
      appeal_allowance_remaining: 1,
      tokens_used_on_item: 2,
      ai_tokens: 1,
      cleanup_token_cost: 1,
      condition: 'new',
      wear_note: null,
      pending_resubmit: false,
    });
    expect(merged.allowed_actions.aiFix).toBe(false);
    expect(merged.tokens_used_on_item).toBe(2);
  });

  it('shows the card for a pending appeal after resubmit lock', () => {
    const recovery = synthesizeRecoveryFromItem({
      id: 'item-1',
      moderation_status: 'pending',
      rejection_reason: 'Blurry',
      current_appeal: {
        id: 'ap-1',
        rejection_id: 'rej-1',
        item_id: 'item-1',
        reason: 'The photos are already accurate enough.',
        evidence_urls: [],
        status: 'pending',
      },
    });
    expect(recovery.pending_resubmit).toBe(true);
    expect(shouldShowRecoveryCard(recovery)).toBe(true);
  });
});

describe('misc contract helpers', () => {
  it('parses categories and condition flags', () => {
    expect(parseRejectionCategory('pricing')).toBe('pricing');
    expect(parseRejectionCategory('nope')).toBe('other');
    expect(isNotAllowedCategory('counterfeit')).toBe(true);
    expect(usedFlagFromCondition('refurbished')).toBe(true);
    expect(isInReviewStatus('ai_reviewing')).toBe(true);
    expect(buildLocalRejection({ id: 'x', moderation_status: 'approved' })).toBe(
      null
    );
  });

  it('orders visible tiles without resubmit (sticky CTA is separate)', () => {
    expect(
      visibleRecoveryActions({
        aiFix: true,
        retake: true,
        condition: false,
        resubmit: true,
        appeal: true,
      })
    ).toEqual(['aiFix', 'retake', 'appeal']);
  });

  it('documents the GraphQL fields the backend will add', () => {
    expect(ITEM_REJECTION_RECOVERY_GQL_FIELDS).toContain('rejection_category');
    expect(ITEM_REJECTION_RECOVERY_GQL_FIELDS).toContain('current_appeal');
    expect(categoryLabelKey('photo_quality')).toBe(
      'business.items.recovery.cat.photo_quality'
    );
    expect(categoryDefaultLabel('counterfeit')).toBe('Possible counterfeit');
  });
});
