import { useEffect, useMemo, useState } from 'react';
import type { InventoryItem } from './useInventoryItem';
import type { ItemVariant } from '../types/itemVariant';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../types/itemVariant';
import { orderedItemImages } from '../utils/orderedItemImages';
import {
  SHOPPER_BASE_VARIANT_ID,
  activeCatalogVariants,
  isShopperBaseVariantId,
  shopperVariantOptions,
} from '../utils/shopperVariantSelection';

/**
 * Default selection + unit pricing for a catalog listing
 * (location override → variant price → inventory, then listing deal).
 * Requires an explicit pick when the item has any DB variants (base + variants).
 */
export function useListingVariantSelection(
  inventoryItem: InventoryItem | null | undefined,
  defaultLabel = 'Default'
) {
  const dbVariants = useMemo(
    () => activeCatalogVariants(inventoryItem?.item?.item_variants),
    [inventoryItem]
  );

  const parentImageUrl = useMemo(() => {
    if (!inventoryItem) return null;
    return orderedItemImages(inventoryItem.item?.item_images)?.[0]?.image_url ?? null;
  }, [inventoryItem]);

  const activeVariants = useMemo(
    () =>
      shopperVariantOptions({
        itemName: inventoryItem?.item?.name ?? '',
        defaultLabel,
        variants: dbVariants,
        parentImageUrl,
      }),
    [inventoryItem?.item?.name, defaultLabel, dbVariants, parentImageUrl]
  );

  const variantIdsKey = useMemo(
    () => activeVariants.map((v) => v.id).join(','),
    [activeVariants]
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!inventoryItem) return;
    if (dbVariants.length === 0) {
      setSelectedVariantId(null);
      return;
    }
    setSelectedVariantId((prev) =>
      prev && activeVariants.some((v) => v.id === prev) ? prev : null
    );
  }, [inventoryItem, variantIdsKey, dbVariants.length, activeVariants]);

  const selectedVariant = useMemo((): ItemVariant | null => {
    if (!selectedVariantId) return null;
    if (isShopperBaseVariantId(selectedVariantId)) return null;
    return dbVariants.find((v) => v.id === selectedVariantId) ?? null;
  }, [dbVariants, selectedVariantId]);

  const listingUnitPricing = useMemo(() => {
    if (!inventoryItem) {
      return {
        unit: 0,
        hasDeal: false,
        strikeOriginal: undefined as number | undefined,
      };
    }
    const base = effectiveVariantUnitPrice(
      selectedVariant,
      inventoryItem.selling_price,
      inventoryItem.variant_price_overrides
    );
    return unitPriceWithListingDeal(
      base,
      inventoryItem.selling_price,
      inventoryItem.hasActiveDeal,
      inventoryItem.original_price,
      inventoryItem.discounted_price,
      inventoryItem.deal_discount_type,
      inventoryItem.deal_discount_value
    );
  }, [inventoryItem, selectedVariant]);

  const variantImageUrl = useMemo(
    () => primaryVariantImageUrl(selectedVariant),
    [selectedVariant]
  );

  const selectionComplete =
    dbVariants.length === 0 || selectedVariantId != null;

  return {
    /** Picker options including synthetic base when DB variants exist. */
    activeVariants,
    dbVariants,
    selectedVariantId,
    setSelectedVariantId,
    selectedVariant,
    listingUnitPricing,
    variantImageUrl,
    selectionComplete,
    requiresSelection: dbVariants.length >= 1,
    isBaseSelected: isShopperBaseVariantId(selectedVariantId),
    SHOPPER_BASE_VARIANT_ID,
  };
}
