import type { BusinessCatalogItem } from '../types/business/items';
import { getItemInventories } from './businessItemUtils';
import { isFoodCategoryName, isMarkedUnavailableToday } from './foodAvailability';

export function isCookedFoodItem(item: BusinessCatalogItem): boolean {
  return isFoodCategoryName(item.item_sub_category?.item_category?.name);
}

export function uniqueInventoryLocationIds(item: BusinessCatalogItem): string[] {
  const ids = getItemInventories(item)
    .map((row) => row.business_location_id ?? row.business_location?.id)
    .filter((id): id is string => !!id);
  return [...new Set(ids)];
}

export function resolveFoodToggleTarget(item: BusinessCatalogItem): {
  businessLocationId: string;
  soldOut: boolean;
} | null {
  if (!isCookedFoodItem(item)) return null;
  const locationIds = uniqueInventoryLocationIds(item);
  if (locationIds.length !== 1) return null;
  return foodToggleForLocation(item, locationIds[0]);
}

function foodToggleForLocation(
  item: BusinessCatalogItem,
  businessLocationId: string
): { businessLocationId: string; soldOut: boolean } {
  const settings = (item.food_item_settings ?? []).find(
    (row) => row.business_location_id === businessLocationId
  );
  return {
    businessLocationId,
    soldOut: isMarkedUnavailableToday(
      settings?.marked_unavailable_at,
      settings?.availability_slots ?? []
    ),
  };
}
