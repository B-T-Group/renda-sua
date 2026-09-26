import type { TFunction } from 'i18next';
import type {
  PurchaseCreditGrant,
  PurchaseCreditShopTarget,
} from '../types/purchaseCredits';

export function isUsablePurchaseCredit(grant: PurchaseCreditGrant): boolean {
  if (grant.revoked_at) return false;
  if (Number(grant.remaining_amount) <= 0) return false;
  if (grant.expires_at) {
    const expires = Date.parse(grant.expires_at);
    if (Number.isFinite(expires) && expires <= Date.now()) return false;
  }
  return true;
}

/** Caps store credit to item subtotal and order total (same rules as checkout). */
export function appliedPurchaseCredit(input: {
  itemSubtotal: number;
  orderTotal: number;
  creditTotal: number;
  depositNow?: number | null;
}): { applied: number; remaining: number; dueAtFulfillment: number } {
  const cap = Math.min(Math.max(0, input.itemSubtotal), Math.max(0, input.orderTotal));
  const applied = Math.min(Math.max(0, input.creditTotal), cap);
  const remaining = Math.max(0, Number((input.orderTotal - applied).toFixed(2)));
  const deposit = input.depositNow && input.depositNow > 0 ? input.depositNow : 0;
  return {
    applied,
    remaining,
    dueAtFulfillment: Math.max(0, Number((remaining - deposit).toFixed(2))),
  };
}

export function isCampaignPurchaseCredit(grant: PurchaseCreditGrant): boolean {
  return grant.source === 'campaign' && isUsablePurchaseCredit(grant);
}

export function purchaseCreditScopeLabel(
  grant: Pick<PurchaseCreditGrant, 'applicability' | 'business'>,
  t: TFunction
): string {
  if (grant.applicability === 'specific_business') {
    return (
      grant.business?.name ||
      t('accounts.purchaseCredits.onePartner', 'One partner store')
    );
  }
  if (grant.applicability === 'partner_businesses') {
    return t(
      'accounts.purchaseCredits.allPartners',
      'Rendasua partner stores'
    );
  }
  return t('accounts.purchaseCredits.anyStore', 'Any store');
}

export function purchaseCreditShopTarget(
  grant: Pick<PurchaseCreditGrant, 'applicability' | 'business_id' | 'business'>
): PurchaseCreditShopTarget {
  if (grant.applicability === 'specific_business') {
    const businessId = grant.business?.id || grant.business_id;
    if (businessId) return { kind: 'store', businessId };
  }
  if (grant.applicability === 'partner_businesses') {
    return { kind: 'partners' };
  }
  return { kind: 'browse' };
}

export function summarizeUsableCredits(grants: PurchaseCreditGrant[]): {
  totalRemaining: number;
  currency: string;
  nearestExpiry: string | null;
  primaryGrant: PurchaseCreditGrant | null;
  usable: PurchaseCreditGrant[];
} {
  const usable = grants.filter(isUsablePurchaseCredit);
  if (usable.length === 0) {
    return {
      totalRemaining: 0,
      currency: 'XAF',
      nearestExpiry: null,
      primaryGrant: null,
      usable,
    };
  }
  const currency = usable[0].currency;
  const sameCurrency = usable.filter((g) => g.currency === currency);
  const totalRemaining = sameCurrency.reduce(
    (sum, g) => sum + Number(g.remaining_amount),
    0
  );
  const expiries = sameCurrency
    .map((g) => g.expires_at)
    .filter((v): v is string => Boolean(v))
    .sort();
  return {
    totalRemaining,
    currency,
    nearestExpiry: expiries[0] ?? null,
    primaryGrant: sameCurrency[0] ?? null,
    usable: sameCurrency,
  };
}

export function hasPartnerScopedCredit(grants: PurchaseCreditGrant[]): boolean {
  return grants.some(
    (g) =>
      isUsablePurchaseCredit(g) &&
      (g.applicability === 'partner_businesses' ||
        g.applicability === 'specific_business')
  );
}

export function partnerBusinessIdsFromCredits(
  grants: PurchaseCreditGrant[]
): Set<string> {
  const ids = new Set<string>();
  for (const grant of grants) {
    if (!isUsablePurchaseCredit(grant)) continue;
    if (grant.applicability === 'specific_business') {
      const id = grant.business?.id || grant.business_id;
      if (id) ids.add(id);
    }
  }
  return ids;
}

/** Whether this catalog store should show a "credits apply" partner badge. */
export function storeShowsCreditPartnerBadge(
  store: { business_id: string; is_partner?: boolean },
  grants: PurchaseCreditGrant[]
): boolean {
  const usable = grants.filter(isUsablePurchaseCredit);
  if (usable.length === 0) return false;
  const specificIds = partnerBusinessIdsFromCredits(usable);
  if (specificIds.has(store.business_id)) return true;
  const hasAllPartners = usable.some(
    (g) => g.applicability === 'partner_businesses'
  );
  return hasAllPartners && store.is_partner === true;
}
