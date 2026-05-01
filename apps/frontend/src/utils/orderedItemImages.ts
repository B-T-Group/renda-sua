import type { ImageType } from '../types/image';

/** Minimal fields required to apply main-first + display_order sorting. */
export type OrderableItemImage = {
  image_url: string;
  image_type: ImageType | 'primary';
  display_order?: number;
};

/** Treat both "main" and legacy/alternate "primary" as preferred hero image types. */
export function isPrimaryItemImageType(
  imageType: OrderableItemImage['image_type']
): boolean {
  return imageType === 'main' || imageType === 'primary';
}

/**
 * Main (primary) image first, then remaining images sorted by display_order.
 * Matches catalog cards and business item views.
 */
export function orderedItemImages<T extends OrderableItemImage>(
  images: T[] | undefined
): T[] {
  if (!images?.length) return [];
  const byOrder = [...images].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  const main = byOrder.find((i) => isPrimaryItemImageType(i.image_type));
  if (!main) return byOrder;
  return [main, ...byOrder.filter((i) => i !== main)];
}

/** Returns preferred hero image (main/primary) or first available image. */
export function getPrimaryOrFirstItemImage<T extends OrderableItemImage>(
  images: T[] | undefined
): T | undefined {
  return orderedItemImages(images)[0];
}
