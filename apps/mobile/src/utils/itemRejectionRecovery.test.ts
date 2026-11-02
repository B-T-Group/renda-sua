import {
  cleanupTokenCost,
  extractRecoveryErrorCode,
  getAppealTileDisabledReason,
  getRecoveryChipPresentation,
  isAlteredCleanup,
  isItemRecoveryPushType,
  isNotAllowedCategory,
  needsToBuyTokens,
  recoveryDeepLinkItemId,
  shouldShowRecoveryCard,
  shouldWarnAppealWithdraw,
  validateAppealEvidence,
  validateAppealReason,
  validateWearNote,
  visibleRecoveryTiles,
} from './itemRejectionRecovery';
import type { ItemRejectionRecovery } from '../types/itemRejectionRecovery';

function rejectedRecovery(): ItemRejectionRecovery {
  return {
    item: {
      id: 'i1',
      name: 'Lamp',
      moderationStatus: 'rejected',
      statusDisplay: 'needs_changes',
      condition: 'new',
      wearNote: null,
    },
    rejection: {
      id: 'r1',
      category: 'wrong_condition',
      reason: 'Wrong condition',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    actions: ['retake', 'condition', 'resubmit', 'appeal'],
    resubmitEditLink: null,
    appeal: null,
    appealsUsed: 0,
    appealLimit: 1,
    canAppeal: true,
    canResubmit: true,
    resubmitWithdrawsAppeal: false,
    aiCleanup: { costPerImage: 1, tokenBalance: 5, tokensSpentOnItem: 0 },
    reviewSlaHours: 24,
    appealSlaHours: 48,
  };
}

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
});

describe('validations and gates', () => {
  it('validates wear notes and appeal input', () => {
    expect(validateWearNote('used', 'Has a scratch on the lid').valid).toBe(true);
    expect(validateWearNote('refurbished', 'tiny').valid).toBe(false);
    expect(validateAppealReason('Please look at this listing again.').valid).toBe(true);
    expect(
      validateAppealEvidence([{ type: 'application/pdf', name: 'receipt.pdf' }]).valid
    ).toBe(true);
  });

  it('disables appeal during review and after the allowance is used', () => {
    expect(
      getAppealTileDisabledReason({
        canAppeal: true,
        pendingResubmit: true,
        appealsUsed: 0,
        appealLimit: 1,
      })
    ).toBe('in_review');
    expect(
      getAppealTileDisabledReason({
        canAppeal: false,
        pendingResubmit: false,
        appealsUsed: 1,
        appealLimit: 1,
      })
    ).toBe('allowance_used');
    expect(shouldWarnAppealWithdraw('pending')).toBe(true);
  });
});

describe('tokens, tiles, and push deep links', () => {
  it('computes cleanup cost and altered confidence', () => {
    expect(cleanupTokenCost(2, 1)).toBe(2);
    expect(needsToBuyTokens(2, 1)).toBe(true);
    expect(isAlteredCleanup({ confidence_check: 'altered' })).toBe(true);
  });

  it('renders only the actions the server returns plus the edit link', () => {
    expect(visibleRecoveryTiles(['retake', 'resubmit', 'appeal'], null)).toEqual([
      'retake',
      'appeal',
    ]);
    expect(visibleRecoveryTiles(['resubmit', 'appeal'], 'price')).toEqual([
      'edit_price',
      'appeal',
    ]);
    expect(shouldShowRecoveryCard(rejectedRecovery())).toBe(true);
  });

  it('routes recovery pushes to the item card', () => {
    expect(isItemRecoveryPushType('business_items_rejected')).toBe(true);
    expect(isItemRecoveryPushType('item_appeal_decided')).toBe(true);
    expect(
      recoveryDeepLinkItemId({ type: 'business_items_rejected', itemId: 'abc' })
    ).toBe('abc');
    expect(isNotAllowedCategory('pricing')).toBe(false);
    expect(
      extractRecoveryErrorCode({ code: 'ITEM_APPEAL_EVIDENCE_LIMIT' })
    ).toBe('ITEM_APPEAL_EVIDENCE_LIMIT');
  });
});
