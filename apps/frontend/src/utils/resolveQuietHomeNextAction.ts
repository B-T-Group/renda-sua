import type { DashboardAggregates } from '../hooks/useDashboardAggregates';
import type { BusinessVerificationStatus } from '../hooks/useBusinessVerification';
import {
  CATALOG_TARGET,
  approvedForInterest,
  resolveCatalogHealth,
  type CatalogHealthPrimary,
} from './catalogHealth';

export type QuietHomeNextActionId =
  | 'cannot_accept_orders'
  | 'id_review'
  | 'confirm_mm_phone'
  | 'fix_rejected'
  | 'restock'
  | 'pending_moderation'
  | 'catalog_goal'
  | 'share_store'
  | 'logo'
  | 'hours'
  | 'offer_rentals'
  | 'offer_sale_items';

export type QuietHomeNextAction = {
  id: QuietHomeNextActionId;
  kind: 'blocker' | 'work' | 'tip';
  remainingToCatalog?: number;
  pendingCount?: number;
};

function tipIdsCoveredByCatalogHealth(
  primary: CatalogHealthPrimary
): Set<string> {
  const covered = new Set<string>();
  if (primary === 'fix_rejected') covered.add('fix_rejected');
  if (primary === 'restock') covered.add('restock');
  if (primary === 'first_item' || primary === 'add_product') {
    covered.add('catalog_goal');
  }
  return covered;
}

export type QuietHomeNextActionInput = {
  aggregates: DashboardAggregates | null | undefined;
  verification: BusinessVerificationStatus | null | undefined;
  mainInterest: string;
  showIdReview: boolean;
  showMmPhoneConfirm: boolean;
};

export type QuietHomeGatingInput = {
  showOperationalModules: boolean;
  aggregatesLoading: boolean;
  aggregates: { ordersTotal?: number } | null | undefined;
  aggregatesError?: string | null;
};

/**
 * Quiet home only after aggregates succeed with zero orders.
 * Loading or failed totals must keep day-to-day fulfillment modules visible.
 */
export function resolveQuietHomeGating(input: QuietHomeGatingInput): {
  quietHomeMode: boolean;
  fulfillmentMode: boolean;
} {
  const aggregatesReady =
    !input.aggregatesLoading && !!input.aggregates && !input.aggregatesError;
  const quietHomeMode =
    input.showOperationalModules &&
    aggregatesReady &&
    (input.aggregates?.ordersTotal ?? 0) === 0;
  return {
    quietHomeMode,
    fulfillmentMode: input.showOperationalModules && !quietHomeMode,
  };
}

/**
 * Web quiet-home next action (no FTUE dismiss). First match wins.
 * Skips tips whose CTA is already on Store reach or Catalog health.
 */
export function resolveQuietHomeNextAction(
  input: QuietHomeNextActionInput
): QuietHomeNextAction | null {
  const v = input.verification;
  if (v && v.can_accept_orders !== true) {
    return { id: 'cannot_accept_orders', kind: 'blocker' };
  }
  if (input.showIdReview) {
    return { id: 'id_review', kind: 'blocker' };
  }
  if (input.showMmPhoneConfirm) {
    return { id: 'confirm_mm_phone', kind: 'blocker' };
  }

  const catalog = resolveCatalogHealth(input.aggregates, input.mainInterest);
  const covered = tipIdsCoveredByCatalogHealth(catalog.primary);
  const a = input.aggregates;
  if (!a) return null;

  // Growth tips respect the merchant tips/reminders preference.
  if (a.tipsRemindersEnabled === false) {
    return null;
  }

  const pending = a.pendingItemCount ?? 0;
  if (pending > 0) {
    return {
      id: 'pending_moderation',
      kind: 'tip',
      pendingCount: pending,
    };
  }

  if ((a.rejectedItemCount ?? 0) > 0 && !covered.has('fix_rejected')) {
    return { id: 'fix_rejected', kind: 'tip' };
  }
  if ((a.topViewedOutOfStockCount ?? 0) > 0 && !covered.has('restock')) {
    return { id: 'restock', kind: 'tip' };
  }

  const approved = approvedForInterest(a, input.mainInterest);
  if (approved < CATALOG_TARGET && !covered.has('catalog_goal')) {
    return {
      id: 'catalog_goal',
      kind: 'tip',
      remainingToCatalog: Math.max(0, CATALOG_TARGET - approved),
    };
  }

  // share_store skipped — Share is on reach card
  if (!a.hasLogo) {
    return { id: 'logo', kind: 'tip' };
  }
  if (!a.hasOperatingHours) {
    return { id: 'hours', kind: 'tip' };
  }

  if (approved >= 1) {
    if (
      input.mainInterest === 'sell_items' &&
      (a.rentalItemCount ?? 0) === 0
    ) {
      return { id: 'offer_rentals', kind: 'tip' };
    }
    if (
      input.mainInterest === 'rent_items' &&
      (a.itemCount ?? 0) === 0
    ) {
      return { id: 'offer_sale_items', kind: 'tip' };
    }
  }

  return null;
}
