import type { PublicCheckoutItemSummary } from '../components/dialogs/PublicItemCheckoutSheet';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import {
  orderedVariantImages,
  type ItemVariant,
} from '../types/business/itemVariant';
import {
  activeCatalogVariants,
  isShopperBaseVariantId,
} from './shopperVariantSelection';

export type CatalogGalleryImage = {
  id: string;
  image_url: string;
  display_order: number;
  display_url?: string | null;
};

export function formatCatalogMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'XAF' }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function catalogSalePrice(inv: CatalogInventoryItem): number {
  const hasDeal =
    inv.hasActiveDeal &&
    typeof inv.original_price === 'number' &&
    typeof inv.discounted_price === 'number' &&
    inv.original_price > inv.discounted_price;
  return hasDeal ? inv.discounted_price! : inv.selling_price;
}

/** Parent item images only (detail fallback, cart hero, variant picker default thumb). */
export function catalogOrderedImages(inv: CatalogInventoryItem): CatalogGalleryImage[] {
  const imgs = inv.item.item_images ?? [];
  return [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

function appendUniqueGalleryImage(
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
 * Dedupes by image URL so shared assets are not repeated.
 */
export function catalogGalleryImages(inv: CatalogInventoryItem): CatalogGalleryImage[] {
  const seen = new Set<string>();
  const out: CatalogGalleryImage[] = [];
  for (const img of catalogOrderedImages(inv)) {
    appendUniqueGalleryImage(out, seen, img);
  }
  for (const variant of activeCatalogVariants(inv.item.item_variants)) {
    for (const img of orderedVariantImages(variant)) {
      appendUniqueGalleryImage(out, seen, {
        id: img.id,
        image_url: img.image_url,
        display_order: img.display_order,
        display_url: img.display_url,
      });
    }
  }
  return out;
}

function variantImagesAsGallery(variant: ItemVariant): CatalogGalleryImage[] {
  return orderedVariantImages(variant).map((img) => ({
    id: img.id,
    image_url: img.image_url,
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
  inv: CatalogInventoryItem,
  selectionId: string | null | undefined
): CatalogGalleryImage[] {
  const parent = catalogOrderedImages(inv);
  const active = activeCatalogVariants(inv.item.item_variants);
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
  inv: CatalogInventoryItem,
  selectionId: string | null | undefined
): CatalogSpecsLabels {
  const active = activeCatalogVariants(inv.item.item_variants);
  const variant =
    selectionId && !isShopperBaseVariantId(selectionId)
      ? active.find((v) => v.id === selectionId)
      : undefined;
  const weight =
    variant?.weight != null ? Number(variant.weight) : Number(inv.item.weight);
  const weightUnit =
    (variant?.weight_unit ?? inv.item.weight_unit)?.trim() || '';
  const dimensions = (
    variant?.dimensions ??
    inv.item.dimensions ??
    ''
  ).trim();

  const out: CatalogSpecsLabels = {};
  if (Number.isFinite(weight) && weight > 0) {
    out.weightLabel = weightUnit ? `${weight} ${weightUnit}` : String(weight);
  }
  if (dimensions) out.dimensionsLabel = dimensions;
  return out;
}

/** List/grid display URL: prefer the generated thumbnail, fall back to the original. */
export function catalogImageDisplayUrl(
  img: { image_url: string; display_url?: string | null } | undefined
): string | undefined {
  const url = (img?.display_url ?? img?.image_url)?.trim();
  return url || undefined;
}

/** Primary listing photo (lowest display_order), matching catalog cards. */
export function primaryCatalogImageUrl(inv: CatalogInventoryItem): string | undefined {
  return catalogImageDisplayUrl(catalogOrderedImages(inv)[0]);
}

export function catalogItemToCheckoutSummary(
  item: CatalogInventoryItem,
  emptyTitle: string
): PublicCheckoutItemSummary {
  const imgs = catalogOrderedImages(item);
  const currency = item.item.currency || 'XAF';
  return {
    title: item.item.name?.trim() || emptyTitle,
    imageUrl: catalogImageDisplayUrl(imgs[0]),
    priceText: formatCatalogMoney(catalogSalePrice(item), currency),
    countryCode: item.business_location?.address?.country,
  };
}
