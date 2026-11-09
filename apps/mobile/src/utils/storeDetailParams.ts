import type { StoreDetailParams } from '../navigation/types';

/** Grocery store links must not carry foodOnly, or the menu stays food-only. */
export function storeDetailParams(
  businessId: string,
  foodMenu: boolean
): StoreDetailParams {
  if (!foodMenu) return { businessId };
  return { businessId, foodOnly: true };
}
