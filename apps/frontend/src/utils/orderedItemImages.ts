import type { ImageType } from '../types/image';
import type { ItemVariant } from '../types/itemVariant';
import { orderedVariantImages } from '../types/itemVariant';
import { activeCatalogVariants } from './shopperVariantSelection';

/** Minimal fields required to apply main-first + display_order sorting. */
export type OrderableItemImage = {
  id?: string;
  image_url: string;
  image_type: ImageType | 'primary';
  display_order?: number;
  /** Generated column: thumbnail when ready, else original image_url. */
  display_url?: string | null;
};

/** List/grid display URL: prefer the generated thumbnail, fall back to the original. */
export function itemImageDisplayUrl(
  image: { image_url: string; display_url?: string | null } | undefined | null
): string | null {
  if (!image) return null;
  return image.display_url ?? image.image_url ?? null;
}

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

export type CatalogGalleryImage = OrderableItemImage & { id: string };

function appendUniqueCatalogImage(
  out: CatalogGalleryImage[],
  seen: Set<string>,
  img: CatalogGalleryImage
): void {
  const urls = [img.image_url, img.display_url]
    .map((u) => u?.trim())
    .filter((u): u is string => !!u);
  if (urls.length === 0 || urls.some((u) => seen.has(u))) return;
  for (const u of urls) seen.add(u);
  out.push(img);
}

/**
 * Catalog card gallery: parent images, then every active variant’s photos.
 * Dedupes by display URL so shared assets are not repeated.
 */
export function catalogGalleryImages(item: {
  item_images?: OrderableItemImage[];
  item_variants?: ItemVariant[] | null;
}): CatalogGalleryImage[] {
  const seen = new Set<string>();
  const out: CatalogGalleryImage[] = [];
  for (const img of orderedItemImages(item.item_images)) {
    if (!img.id) continue;
    appendUniqueCatalogImage(out, seen, img as CatalogGalleryImage);
  }
  for (const variant of activeCatalogVariants(item.item_variants)) {
    for (const img of orderedVariantImages(variant)) {
      appendUniqueCatalogImage(out, seen, {
        id: img.id,
        image_url: img.image_url,
        image_type: 'gallery',
        display_order: img.display_order,
        display_url: img.display_url,
      });
    }
  }
  return out;
}
