import type { BusinessVerificationStatus } from '../services/businessVerificationApi';
import type { DashboardAggregates } from '../types/business/dashboard';
import {
  type MerchantTipId,
  type ResolvedMerchantTip,
  type StoreReadinessInput,
  approvedForInterest,
  resolveMerchantTip,
} from './businessStoreReadiness';
import {
  resolveCatalogHealth,
  tipIdsCoveredByCatalogHealth,
} from './catalogHealth';

export type QuietHomeNextActionId =
  | 'cannot_accept_orders'
  | 'id_review'
  | 'confirm_mm_phone'
  | 'actions_needed'
  | 'offer_rentals'
  | 'offer_sale_items'
  | MerchantTipId;

export type QuietHomeNextAction = {
  id: QuietHomeNextActionId;
  kind: 'blocker' | 'work' | 'tip' | 'celebration';
  remainingToCatalog?: number;
  pendingCount?: number;
  actionsCount?: number;
};

export type QuietHomeNextActionInput = StoreReadinessInput & {
  /** Number of undismissed Actions Needed items. */
  actionsNeededCount: number;
  /** Same conditions as dashboard showIdReviewCard. */
  showIdReview: boolean;
  /** Same conditions as dashboard showMobilePaymentPhoneCta. */
  showMmPhoneConfirm: boolean;
  /**
   * Tips whose CTA is already the primary on Store reach (share / preview).
   * Always skipped on quiet home.
   */
  skipReachDuplicateTips?: boolean;
};

const REACH_DUPLICATE_TIPS: ReadonlySet<MerchantTipId> = new Set([
  'share_store',
  'preview_store',
]);

function tipToNextAction(tip: ResolvedMerchantTip): QuietHomeNextAction {
  return {
    id: tip.id,
    kind: tip.kind,
    remainingToCatalog: tip.remainingToCatalog,
    pendingCount: tip.pendingCount,
  };
}

/**
 * Single next action for quiet (no active orders) business home.
 * First match wins: blockers → in-flight work → growth tip (with CTA skips).
 */
export function resolveQuietHomeNextAction(
  input: QuietHomeNextActionInput
): QuietHomeNextAction | null {
  const verification = input.verification;
  const canAccept = verification?.can_accept_orders === true;

  if (verification && !canAccept) {
    return { id: 'cannot_accept_orders', kind: 'blocker' };
  }

  if (input.showIdReview) {
    return { id: 'id_review', kind: 'blocker' };
  }

  if (input.showMmPhoneConfirm) {
    return { id: 'confirm_mm_phone', kind: 'blocker' };
  }

  if (input.actionsNeededCount > 0) {
    return {
      id: 'actions_needed',
      kind: 'work',
      actionsCount: input.actionsNeededCount,
    };
  }

  const catalog = resolveCatalogHealth(
    input.aggregates,
    input.mainInterest
  );
  const coveredByCatalog = tipIdsCoveredByCatalogHealth(catalog.primary);
  const skipReach = input.skipReachDuplicateTips !== false;

  // Pending moderation as work when catalog health does not own that CTA.
  const pending = input.aggregates?.pendingItemCount ?? 0;
  if (
    pending > 0 &&
    !input.actionsNeededPendingFocus &&
    !coveredByCatalog.has('pending_moderation') &&
    input.isNudgeEligible('merchant-tip:pending_moderation')
  ) {
    return {
      id: 'pending_moderation',
      kind: 'tip',
      pendingCount: pending,
    };
  }

  const tip = resolveMerchantTip(input);
  if (tip) {
    if (skipReach && REACH_DUPLICATE_TIPS.has(tip.id)) {
      return resolveQuietHomeNextActionAfterSkip(input, tip.id);
    }
    if (coveredByCatalog.has(tip.id)) {
      return resolveQuietHomeNextActionAfterSkip(input, tip.id);
    }
    return tipToNextAction(tip);
  }

  return resolveSecondaryCatalogOfferTip(input);
}

function resolveSecondaryCatalogOfferTip(
  input: QuietHomeNextActionInput
): QuietHomeNextAction | null {
  if (!input.tipsRemindersEnabled) return null;
  const a = input.aggregates;
  if (!a) return null;
  const approved = approvedForInterest(a, input.mainInterest);
  if (approved < 1) return null;

  if (
    input.mainInterest === 'sell_items' &&
    (a.rentalItemCount ?? 0) === 0 &&
    input.isNudgeEligible('merchant-tip:offer_rentals')
  ) {
    return { id: 'offer_rentals', kind: 'tip' };
  }
  if (
    input.mainInterest === 'rent_items' &&
    (a.itemCount ?? 0) === 0 &&
    input.isNudgeEligible('merchant-tip:offer_sale_items')
  ) {
    return { id: 'offer_sale_items', kind: 'tip' };
  }
  return null;
}

/**
 * Re-run tip resolution after marking a tip as ineligible so we pick the next
 * growth tip instead of returning null / a duplicate CTA.
 */
function resolveQuietHomeNextActionAfterSkip(
  input: QuietHomeNextActionInput,
  skippedId: MerchantTipId
): QuietHomeNextAction | null {
  const blocked = new Set<string>([`merchant-tip:${skippedId}`]);
  const wrapped: QuietHomeNextActionInput = {
    ...input,
    isNudgeEligible: (id) => {
      if (blocked.has(id)) return false;
      return input.isNudgeEligible(id);
    },
  };

  // Walk remaining tips by repeatedly resolving with cumulative skips.
  for (let i = 0; i < 20; i++) {
    const tip = resolveMerchantTip(wrapped);
    if (!tip) {
      return resolveSecondaryCatalogOfferTip(wrapped);
    }

    const catalog = resolveCatalogHealth(
      input.aggregates,
      input.mainInterest
    );
    const covered = tipIdsCoveredByCatalogHealth(catalog.primary);
    const skipReach = input.skipReachDuplicateTips !== false;

    if (
      (skipReach && REACH_DUPLICATE_TIPS.has(tip.id)) ||
      covered.has(tip.id)
    ) {
      blocked.add(`merchant-tip:${tip.id}`);
      continue;
    }
    return tipToNextAction(tip);
  }
  return null;
}

export type QuietHomeAggregatesInput = {
  aggregates: DashboardAggregates | null | undefined;
  verification: BusinessVerificationStatus | null | undefined;
  mainInterest: string;
  aiTokens: number;
  tipsRemindersEnabled: boolean;
  actionsNeededCount: number;
  actionsNeededPendingFocus?: boolean;
  showIdReview: boolean;
  showMmPhoneConfirm: boolean;
  isNudgeEligible: (id: string) => boolean;
};
