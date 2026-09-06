import type { BusinessItemImage } from '../types/business/items';

export function isPrimaryItemImageType(imageType?: string | null): boolean {
  return imageType === 'main' || imageType === 'primary';
}

export function orderedItemImages(images: BusinessItemImage[] | undefined): BusinessItemImage[] {
  if (!images?.length) return [];
  const list = [...images].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const mainIdx = list.findIndex((img) => isPrimaryItemImageType(img.image_type));
  if (mainIdx > 0) {
    const [main] = list.splice(mainIdx, 1);
    list.unshift(main);
  }
  return list;
}
