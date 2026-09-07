import type { BusinessVerificationStatus } from '../services/businessVerificationApi';
import type { DashboardAggregates } from '../types/business/dashboard';

export const CATALOG_TARGET = 10;

export type MerchantTipId =
  | 'first_order_congrats'
  | 'catalog_10_congrats'
  | 'views_10_congrats'
  | 'rejected_item'
  | 'restock_top_viewed'
  | 'catalog_goal'
  | 'catalog_variety'
  | 'share_store'
  | 'ai_photos_pending'
  | 'ai_tokens_empty'
  | 'pending_moderation'
  | 'logo'
  | 'hours'
  | 'preview_store'
  | 'ai_photos'
  | 'insights';

export type ReadinessStepId = 'logo' | 'hours' | 'catalog_10' | 'mm_phone';

export type ReadinessStep = {
  id: ReadinessStepId;
  done: boolean;
  /** Progress toward a numeric goal (e.g. catalog_10). */
  current?: number;
  target?: number;
};

export type StoreReadinessInput = {
  aggregates: DashboardAggregates | null | undefined;
  verification: BusinessVerificationStatus | null | undefined;
  mainInterest: 'sell_items' | 'rent_items' | string;
  aiTokens: number;
  tipsRemindersEnabled: boolean;
  /** True when Actions Needed already surfaces pending moderation as top focus. */
  actionsNeededPendingFocus?: boolean;
  isNudgeEligible: (id: string) => boolean;
};

export function approvedForInterest(
  aggregates: DashboardAggregates | null | undefined,
  mainInterest: string
): number {
  if (!aggregates) return 0;
  if (mainInterest === 'rent_items') {
    if (typeof aggregates.approvedRentalCount === 'number') {
      return aggregates.approvedRentalCount;
    }
    // Older aggregates payloads omit approved* fields.
    return aggregates.rentalItemCount ?? 0;
  }
  if (typeof aggregates.approvedItemCount === 'number') {
    return aggregates.approvedItemCount;
  }
  return aggregates.itemCount ?? 0;
}

export function buildReadinessSteps(input: StoreReadinessInput): ReadinessStep[] {
  const { aggregates, verification, mainInterest } = input;
  const approved = approvedForInterest(aggregates, mainInterest);
  const steps: ReadinessStep[] = [
    { id: 'logo', done: aggregates?.hasLogo === true },
    { id: 'hours', done: aggregates?.hasOperatingHours === true },
    {
      id: 'catalog_10',
      done: approved >= CATALOG_TARGET,
      current: Math.min(approved, CATALOG_TARGET),
      target: CATALOG_TARGET,
    },
  ];
  if (verification?.paymentRail === 'mobile_money') {
    steps.push({
      id: 'mm_phone',
      done: verification.steps.mobilePaymentPhone?.complete === true,
    });
  }
  return steps;
}

export function readinessPercent(steps: ReadinessStep[]): number {
  if (steps.length === 0) return 100;
  const done = steps.filter((s) => s.done).length;
  return Math.round((done / steps.length) * 100);
}

export type ResolvedMerchantTip = {
  id: MerchantTipId;
  kind: 'celebration' | 'tip';
  remainingToCatalog?: number;
  pendingCount?: number;
};

export function resolveMerchantTip(
  input: StoreReadinessInput
): ResolvedMerchantTip | null {
  if (!input.tipsRemindersEnabled) return null;
  const a = input.aggregates;
  if (!a) return null;
  const approved = approvedForInterest(a, input.mainInterest);
  const eligible = input.isNudgeEligible;

  const candidates: Array<[ResolvedMerchantTip, boolean]> = [
    [
      { id: 'first_order_congrats', kind: 'celebration' },
      a.ordersTotal >= 1 && eligible('merchant-tip:first_order_congrats'),
    ],
    [
      { id: 'catalog_10_congrats', kind: 'celebration' },
      approved >= CATALOG_TARGET && eligible('merchant-tip:catalog_10_congrats'),
    ],
    [
      { id: 'views_10_congrats', kind: 'celebration' },
      a.totalProductViews >= 10 && eligible('merchant-tip:views_10_congrats'),
    ],
    [
      { id: 'rejected_item', kind: 'tip' },
      (a.rejectedItemCount ?? 0) > 0 && eligible('merchant-tip:rejected_item'),
    ],
    [
      { id: 'restock_top_viewed', kind: 'tip' },
      (a.topViewedOutOfStockCount ?? 0) > 0 &&
        eligible('merchant-tip:restock_top_viewed'),
    ],
    [
      {
        id: 'catalog_goal',
        kind: 'tip',
        remainingToCatalog: Math.max(0, CATALOG_TARGET - approved),
      },
      approved < CATALOG_TARGET && eligible('merchant-tip:catalog_goal'),
    ],
    [
      { id: 'catalog_variety', kind: 'tip' },
      a.totalProductViews >= 10 &&
        approved >= CATALOG_TARGET &&
        approved < 25 &&
        eligible('merchant-tip:catalog_variety'),
    ],
    [
      { id: 'share_store', kind: 'tip' },
      (a.totalProductViews >= 10 || approved >= CATALOG_TARGET) &&
        approved >= 1 &&
        eligible('merchant-tip:share_store'),
    ],
    [
      { id: 'ai_photos_pending', kind: 'tip' },
      (a.itemsNeedingAiCleanupCount ?? 0) > 0 &&
        input.aiTokens > 0 &&
        eligible('merchant-tip:ai_photos_pending'),
    ],
    [
      { id: 'ai_tokens_empty', kind: 'tip' },
      (a.itemsNeedingAiCleanupCount ?? 0) > 0 &&
        input.aiTokens === 0 &&
        eligible('merchant-tip:ai_tokens_empty'),
    ],
    [
      {
        id: 'pending_moderation',
        kind: 'tip',
        pendingCount: a.pendingItemCount ?? 0,
      },
      (a.pendingItemCount ?? 0) > 0 &&
        !input.actionsNeededPendingFocus &&
        eligible('merchant-tip:pending_moderation'),
    ],
    [
      { id: 'logo', kind: 'tip' },
      !a.hasLogo && eligible('merchant-tip:logo'),
    ],
    [
      { id: 'hours', kind: 'tip' },
      !a.hasOperatingHours && eligible('merchant-tip:hours'),
    ],
    [
      { id: 'preview_store', kind: 'tip' },
      approved >= 1 && eligible('merchant-tip:preview_store'),
    ],
    [
      { id: 'ai_photos', kind: 'tip' },
      (a.itemCount ?? 0) >= 1 &&
        input.aiTokens > 0 &&
        (a.itemsNeedingAiCleanupCount ?? 0) === 0 &&
        eligible('merchant-tip:ai_photos'),
    ],
    [
      { id: 'insights', kind: 'tip' },
      a.totalProductViews > 0 &&
        readinessPercent(buildReadinessSteps(input)) >= 50 &&
        eligible('merchant-tip:insights'),
    ],
  ];

  for (const [tip, ok] of candidates) {
    if (ok) return tip;
  }
  return null;
}
