import type { ImageType } from '../types/image';
import type { ItemVariant } from '../types/itemVariant';
import { orderedVariantImages } from '../types/itemVariant';
import {
  activeCatalogVariants,
  isShopperBaseVariantId,
} from './shopperVariantSelection';

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

function parentCatalogImages(item: {
  item_images?: OrderableItemImage[];
}): CatalogGalleryImage[] {
  const out: CatalogGalleryImage[] = [];
  for (const img of orderedItemImages(item.item_images)) {
    if (!img.id) continue;
    out.push(img as CatalogGalleryImage);
  }
  return out;
}

function variantImagesAsGallery(variant: ItemVariant): CatalogGalleryImage[] {
  return orderedVariantImages(variant).map((img) => ({
    id: img.id,
    image_url: img.image_url,
    image_type: 'gallery' as const,
    display_order: img.display_order,
    display_url: img.display_url,
  }));
}

/**
 * Gallery scoped to a shopper selection.
 * No variants / base / unset → parent images.
 * Concrete variant → that variant’s photos, else parent fallback.
 */
export function catalogGalleryForSelection(
  item: {
    item_images?: OrderableItemImage[];
    item_variants?: ItemVariant[] | null;
    weight?: number | null;
    weight_unit?: string | null;
    dimensions?: string | null;
  },
  selectionId: string | null | undefined
): CatalogGalleryImage[] {
  const parent = parentCatalogImages(item);
  const active = activeCatalogVariants(item.item_variants);
  if (active.length === 0) return parent;
  if (!selectionId || isShopperBaseVariantId(selectionId)) return parent;
  const variant = active.find((v) => v.id === selectionId);
  if (!variant) return parent;
  const scoped = variantImagesAsGallery(variant);
  return scoped.length > 0 ? scoped : parent;
}

export type CatalogSpecsLabels = {
  weightLabel?: string;
  dimensionsLabel?: string;
};

/** Weight / dimensions for the selected option (variant overrides parent). */
export function catalogSpecsForSelection(
  item: {
    weight?: number | null;
    weight_unit?: string | null;
    dimensions?: string | null;
    item_variants?: ItemVariant[] | null;
  },
  selectionId: string | null | undefined
): CatalogSpecsLabels {
  const active = activeCatalogVariants(item.item_variants);
  const variant =
    selectionId && !isShopperBaseVariantId(selectionId)
      ? active.find((v) => v.id === selectionId)
      : undefined;
  const weight =
    variant?.weight != null ? Number(variant.weight) : Number(item.weight);
  const weightUnit = (variant?.weight_unit ?? item.weight_unit)?.trim() || '';
  const dimensions = (variant?.dimensions ?? item.dimensions ?? '').trim();

  const out: CatalogSpecsLabels = {};
  if (Number.isFinite(weight) && weight > 0) {
    out.weightLabel = weightUnit ? `${weight} ${weightUnit}` : String(weight);
  }
  if (dimensions) out.dimensionsLabel = dimensions;
  return out;
}
