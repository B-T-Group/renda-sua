/** Merchant lifecycle fields on catalog / verification API payloads. */
export type MerchantLifecycleStatus =
  | 'created'
  | 'contract_signed'
  | 'active'
  | 'suspended'
  | string;

export interface MerchantLifecycleFields {
  is_verified?: boolean;
  can_accept_orders?: boolean;
  /** Catalog visibility (rail-aware; independent of can_accept_orders). */
  is_storefront_visible?: boolean;
  lifecycle_status?: MerchantLifecycleStatus | null;
}

export function merchantCanAcceptOrders(
  business?: MerchantLifecycleFields | null
): boolean {
  return business?.can_accept_orders ?? business?.is_verified ?? false;
}

/** Visible in catalog but not yet accepting orders. */
export function isOpeningSoonMerchant(
  business?: MerchantLifecycleFields | null
): boolean {
  if (!business) return false;
  const visible = business.is_storefront_visible === true;
  return visible && !merchantCanAcceptOrders(business);
}
