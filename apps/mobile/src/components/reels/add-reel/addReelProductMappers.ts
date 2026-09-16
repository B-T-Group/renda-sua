import type { BusinessCatalogItem } from '@/types/business/items';
import type { BusinessRentalItemRow } from '@/types/rentals';
import type { PickerProduct } from './addReelTypes';

export function mapSaleProducts(items: BusinessCatalogItem[]): PickerProduct[] {
  return items.map((item) => ({
    subjectType: 'item' as const,
    subjectId: item.id,
    name: item.name,
    imageUrl:
      item.item_images?.[0]?.display_url ||
      item.item_images?.[0]?.image_url ||
      null,
  }));
}

export function mapRentalProducts(
  items: BusinessRentalItemRow[]
): PickerProduct[] {
  return items.map((item) => ({
    subjectType: 'rental' as const,
    subjectId: item.id,
    name: item.name,
    imageUrl: item.rental_item_images?.[0]?.image_url || null,
  }));
}
