import type { ImageType } from '../types/image';

/** Minimal fields required to apply main-first + display_order sorting. */
export type OrderableItemImage = {
  image_url: string;
  image_type: ImageType;
  display_order?: number;
};

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
  const main = byOrder.find((i) => i.image_type === 'main');
  if (!main) return byOrder;
  return [main, ...byOrder.filter((i) => i !== main)];
}
