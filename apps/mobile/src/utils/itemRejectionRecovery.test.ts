import { ITEM_REJECTION_RECOVERY_GQL_FIELDS } from '../types/itemRejectionRecovery';
import {
  cleanupTokenCost,
  extractRecoveryErrorCode,
  fallbackAllowedActions,
  getAppealTileDisabledReason,
  getRecoveryChipPresentation,
  isAlteredCleanup,
  isItemRecoveryPushType,
  isNotAllowedCategory,
  mergeRecoveryPayload,
  needsToBuyTokens,
  recoveryDeepLinkItemId,
  shouldShowRecoveryCard,
  shouldWarnAppealWithdraw,
  synthesizeRecoveryFromItem,
  validateAppealEvidence,
  validateAppealReason,
  validateWearNote,
  visibleRecoveryActions,
} from './itemRejectionRecovery';

describe('fallbackAllowedActions', () => {
  it('allows only appeal for prohibited and counterfeit', () => {
    expect(fallbackAllowedActions('prohibited_item').appeal).toBe(true);
    expect(fallbackAllowedActions('prohibited_item').resubmit).toBe(false);
    expect(fallbackAllowedActions('counterfeit').aiFix).toBe(false);
  });

  it('matches the spec map for photo_quality and pricing', () => {
    expect(fallbackAllowedActions('photo_quality')).toMatchObject({
      aiFix: true,
      retake: true,
      condition: false,
      resubmit: true,
    });
    expect(fallbackAllowedActions('pricing')).toMatchObject({
      editPrice: true,
      retake: false,
      resubmit: true,
    });
  });
});

describe('chip presentation', () => {
  it('maps rejected categories to Needs changes or Not allowed', () => {
    expect(
      getRecoveryChipPresentation({
        status: 'rejected',
        category: 'missing_info',
      }).defaultLabel
    ).toBe('Needs changes');
    expect(
      getRecoveryChipPresentation({
        status: 'rejected',
        category: 'prohibited_item',
      }).tone
    ).toBe('error');
  });

  it('shows In review after a resubmit', () => {
    expect(
      getRecoveryChipPresentation({
        status: 'pending',
        pendingResubmit: true,
      }).labelKey
    ).toBe('business.items.recovery.status.inReview');
  });
});

describe('validations and gates', () => {
  it('validates wear notes and appeal input', () => {
    expect(validateWearNote('used', 'Has a scratch on the lid').valid).toBe(true);
    expect(validateWearNote('refurbished', 'tiny').valid).toBe(false);
    expect(validateAppealReason('Please look at this listing again.').valid).toBe(
      true
    );
    expect(
      validateAppealEvidence([{ type: 'application/pdf', name: 'receipt.pdf' }])
        .valid
    ).toBe(true);
  });

  it('disables appeal during review and after the allowance is used', () => {
    expect(
      getAppealTileDisabledReason({
        allowed: true,
        pendingResubmit: true,
        allowanceRemaining: 1,
      })
    ).toBe('in_review');
    expect(
      getAppealTileDisabledReason({
        allowed: true,
        pendingResubmit: false,
        allowanceRemaining: 0,
      })
    ).toBe('allowance_used');
    expect(shouldWarnAppealWithdraw('pending')).toBe(true);
  });
});

describe('tokens, merge, and push deep links', () => {
  it('computes cleanup cost and altered confidence', () => {
    expect(cleanupTokenCost(2, 1)).toBe(2);
    expect(needsToBuyTokens(2, 1)).toBe(true);
    expect(isAlteredCleanup({ confidence_check: 'altered' })).toBe(true);
  });

  it('uses server allowed_actions when present', () => {
    const merged = mergeRecoveryPayload({
      item_id: 'i1',
      moderation_status: 'rejected',
      rejection: {
        id: 'r1',
        item_id: 'i1',
        category: 'other',
        reason: 'Need a closer photo',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      allowed_actions: {
        aiFix: false,
        retake: true,
        condition: false,
        resubmit: true,
        appeal: true,
      },
      appeal: null,
      appeal_history: [],
      appeal_allowance_remaining: 1,
      tokens_used_on_item: 0,
      ai_tokens: 5,
      cleanup_token_cost: 1,
      condition: 'new',
      wear_note: null,
      pending_resubmit: false,
    });
    expect(visibleRecoveryActions(merged.allowed_actions)).toEqual([
      'retake',
      'appeal',
    ]);
  });

  it('synthesizes a card for current rejected items', () => {
    const recovery = synthesizeRecoveryFromItem({
      id: 'i1',
      moderation_status: 'rejected',
      rejection_reason: 'Wrong condition',
      rejection_category: 'wrong_condition',
    });
    expect(shouldShowRecoveryCard(recovery)).toBe(true);
    expect(recovery.allowed_actions.condition).toBe(true);
  });

  it('routes recovery pushes to the item card', () => {
    expect(isItemRecoveryPushType('business_items_rejected')).toBe(true);
    expect(isItemRecoveryPushType('item_appeal_decided')).toBe(true);
    expect(
      recoveryDeepLinkItemId({ type: 'business_items_rejected', itemId: 'abc' })
    ).toBe('abc');
    expect(recoveryDeepLinkItemId({ entity_id: 'ent-1' })).toBe('ent-1');
    expect(isNotAllowedCategory('pricing')).toBe(false);
    expect(extractRecoveryErrorCode({ code: 'EVIDENCE_LIMIT' })).toBe(
      'EVIDENCE_LIMIT'
    );
    expect(ITEM_REJECTION_RECOVERY_GQL_FIELDS).toContain('wear_note');
  });
});
