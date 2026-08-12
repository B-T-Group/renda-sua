import type {
  MerchantEngagementCandidate,
  MerchantEngagementPushId,
} from './merchant-engagement.types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CATALOG_TARGET = 10;

export function approvedForInterest(c: MerchantEngagementCandidate): number {
  return c.mainInterest === 'rent_items'
    ? c.approvedRentalCount
    : c.approvedItemCount;
}

export function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / DAY_MS;
}

export function readinessPercent(c: MerchantEngagementCandidate): number {
  const steps = [
    c.hasLogo,
    c.hasOperatingHours,
    approvedForInterest(c) >= CATALOG_TARGET,
  ];
  if (typeof c.mmPhoneComplete === 'boolean') {
    steps.push(c.mmPhoneComplete);
  }
  const done = steps.filter(Boolean).length;
  return Math.round((done / steps.length) * 100);
}

/** Resolve first eligible push id for a candidate (priority order). */
export function resolveEngagementPushId(
  c: MerchantEngagementCandidate,
  now: Date,
  lastSentByPushId: Map<string, Date>
): MerchantEngagementPushId | null {
  if (!c.tipsRemindersEnabled || !c.canAcceptOrders) return null;
  if (c.lifecycleStatus === 'suspended') return null;

  const checks: Array<[MerchantEngagementPushId, () => boolean]> = [
    [
      'push_first_order_congrats',
      () =>
        recentMilestone(c, now) &&
        once(c.ordersTotal >= 1, 'push_first_order_congrats', lastSentByPushId),
    ],
    [
      'push_catalog_10_congrats',
      () =>
        recentMilestone(c, now) &&
        once(
          approvedForInterest(c) >= CATALOG_TARGET,
          'push_catalog_10_congrats',
          lastSentByPushId
        ),
    ],
    [
      'push_views_10',
      () =>
        recentMilestone(c, now) &&
        once(c.totalProductViews >= 10, 'push_views_10', lastSentByPushId),
    ],
    ['push_catalog_stalled', () => catalogStalled(c, now, lastSentByPushId, 7, 14)],
    ['push_rejected_item', () => cooldown(c.rejectedItemCount > 0 && (daysSince(c.lastCatalogItemAt, now) ?? 99) >= 2, 'push_rejected_item', 14, lastSentByPushId, now)],
    ['push_restock_top_viewed', () => cooldown(c.topViewedOutOfStockCount > 0, 'push_restock_top_viewed', 14, lastSentByPushId, now)],
    ['push_ai_cleanup', () => cooldown(c.itemsNeedingAiCleanupCount > 0 && c.aiTokens > 0, 'push_ai_cleanup', 14, lastSentByPushId, now)],
    ['push_buy_tokens', () => cooldown(c.itemsNeedingAiCleanupCount > 0 && c.aiTokens === 0, 'push_buy_tokens', 21, lastSentByPushId, now)],
    ['push_hours_logo', () => hoursLogo(c, now, lastSentByPushId)],
    ['push_share_store', () => shareStore(c, now, lastSentByPushId)],
    ['push_catalog_stalled_post10', () => catalogStalledPost10(c, now, lastSentByPushId)],
  ];

  for (const [id, ok] of checks) {
    if (ok()) return id;
  }
  return null;
}

/** Avoid false “congrats” for long-live merchants when the send log is empty. */
function recentMilestone(
  c: MerchantEngagementCandidate,
  now: Date
): boolean {
  const liveDays = daysSince(c.liveSince, now);
  return liveDays != null && liveDays <= 45;
}

function once(
  condition: boolean,
  pushId: string,
  lastSent: Map<string, Date>
): boolean {
  return condition && !lastSent.has(pushId);
}

function cooldown(
  condition: boolean,
  pushId: string,
  days: number,
  lastSent: Map<string, Date>,
  now: Date
): boolean {
  if (!condition) return false;
  const prev = lastSent.get(pushId);
  if (!prev) return true;
  return (now.getTime() - prev.getTime()) / DAY_MS >= days;
}

/**
 * Exponential backoff: after N prior sends, wait min(maxDays, baseDays * 2^(N-1))
 * days since the last send. First send (N=0) is due immediately.
 */
export function isExponentialBackoffDue(
  lastSent: Date | undefined,
  priorSendCount: number,
  now: Date,
  options?: { baseDays?: number; maxDays?: number }
): boolean {
  if (!lastSent || priorSendCount <= 0) return true;
  const baseDays = options?.baseDays ?? 1;
  const maxDays = options?.maxDays ?? 30;
  const delayDays = Math.min(
    maxDays,
    baseDays * Math.pow(2, Math.max(0, priorSendCount - 1))
  );
  return (now.getTime() - lastSent.getTime()) / DAY_MS >= delayDays;
}

/** Eligible for the payment-setup nudge (views + incomplete payment setup). */
export function isPaymentSetupNudgeDue(
  c: MerchantEngagementCandidate,
  now: Date,
  lastSent: Date | undefined,
  priorSendCount: number
): boolean {
  if (!c.tipsRemindersEnabled) return false;
  if (c.lifecycleStatus === 'suspended') return false;
  if (!c.needsPaymentSetupNudge) return false;
  if ((c.paymentSetupViewCount ?? 0) < 1) return false;
  return isExponentialBackoffDue(lastSent, priorSendCount, now);
}

function catalogStalled(
  c: MerchantEngagementCandidate,
  now: Date,
  lastSent: Map<string, Date>,
  idleDays: number,
  cooldownDays: number
): boolean {
  if (approvedForInterest(c) >= CATALOG_TARGET) return false;
  const anchor = c.lastCatalogItemAt ?? c.liveSince;
  const idle = daysSince(anchor, now);
  if (idle == null || idle < idleDays) return false;
  return cooldown(true, 'push_catalog_stalled', cooldownDays, lastSent, now);
}

function catalogStalledPost10(
  c: MerchantEngagementCandidate,
  now: Date,
  lastSent: Map<string, Date>
): boolean {
  if (approvedForInterest(c) < CATALOG_TARGET) return false;
  if (c.totalProductViews < 10) return false;
  const idle = daysSince(c.lastCatalogItemAt ?? c.liveSince, now);
  if (idle == null || idle < 14) return false;
  return cooldown(true, 'push_catalog_stalled_post10', 21, lastSent, now);
}

function hoursLogo(
  c: MerchantEngagementCandidate,
  now: Date,
  lastSent: Map<string, Date>
): boolean {
  const liveDays = daysSince(c.liveSince, now);
  if (liveDays == null || liveDays < 3) return false;
  if (c.hasLogo && c.hasOperatingHours) return false;
  return cooldown(true, 'push_hours_logo', 14, lastSent, now);
}

function shareStore(
  c: MerchantEngagementCandidate,
  now: Date,
  lastSent: Map<string, Date>
): boolean {
  const liveDays = daysSince(c.liveSince, now);
  if (liveDays == null || liveDays < 5) return false;
  const traction =
    c.totalProductViews >= 10 || approvedForInterest(c) >= CATALOG_TARGET;
  if (!traction || approvedForInterest(c) < 1) return false;
  return cooldown(true, 'push_share_store', 30, lastSent, now);
}

export function nextStepCopy(
  c: MerchantEngagementCandidate,
  preferredLanguage: string | null
): string {
  const fr = preferredLanguage?.toLowerCase().startsWith('fr');
  if (c.rejectedItemCount > 0) {
    return fr ? 'Corriger les produits refusés' : 'Fix rejected products';
  }
  if (approvedForInterest(c) < CATALOG_TARGET) {
    return fr
      ? `Ajouter des produits (${approvedForInterest(c)}/${CATALOG_TARGET})`
      : `Add products (${approvedForInterest(c)}/${CATALOG_TARGET})`;
  }
  if (!c.hasLogo) return fr ? 'Ajouter un logo' : 'Add a business logo';
  if (!c.hasOperatingHours) {
    return fr ? 'Personnaliser les horaires' : 'Customize business hours';
  }
  if (c.itemsNeedingAiCleanupCount > 0 && c.aiTokens > 0) {
    return fr ? 'Nettoyer les photos avec l’IA' : 'Clean up product photos with AI';
  }
  return fr ? 'Partager votre boutique' : 'Share your storefront';
}
