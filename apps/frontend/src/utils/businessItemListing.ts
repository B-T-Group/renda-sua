/** Active deal: flag on and current time within [start_at, end_at]. */
export function isActiveItemDeal(deal: {
  is_active?: boolean;
  start_at?: string;
  end_at?: string;
}): boolean {
  if (!deal?.is_active) return false;
  const now = Date.now();
  const s = Date.parse(String(deal.start_at));
  const e = Date.parse(String(deal.end_at));
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  return now >= s && now <= e;
}

/** Active promotion window on `business_inventory.promotion` JSON. */
export function isActiveInventoryPromotion(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  if (o.promoted !== true) return false;
  const now = Date.now();
  if (o.start) {
    const start = Date.parse(String(o.start));
    if (Number.isFinite(start) && now < start) return false;
  }
  if (o.end) {
    const end = Date.parse(String(o.end));
    if (Number.isFinite(end) && now > end) return false;
  }
  return true;
}

export function itemHasActiveDeal(item: {
  business_inventories?: Array<{ item_deals?: unknown[] }>;
}): boolean {
  return (
    item.business_inventories?.some((inv) =>
      (inv.item_deals as Array<{ is_active?: boolean; start_at?: string; end_at?: string }>)?.some(
        (d) => isActiveItemDeal(d)
      )
    ) ?? false
  );
}

export function itemHasActivePromotion(item: {
  business_inventories?: Array<{ promotion?: unknown }>;
}): boolean {
  return (
    item.business_inventories?.some((inv) =>
      isActiveInventoryPromotion(inv.promotion)
    ) ?? false
  );
}

export function itemHasSponsoredPromotion(item: {
  business_inventories?: Array<{ promotion?: unknown }>;
}): boolean {
  return (
    item.business_inventories?.some((inv) => {
      const p = inv.promotion as { sponsored?: boolean } | null | undefined;
      return isActiveInventoryPromotion(inv.promotion) && p?.sponsored === true;
    }) ?? false
  );
}
