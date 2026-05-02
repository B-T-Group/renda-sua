import { useEffect, useMemo, useState } from 'react';
import type { InventoryItem } from './useInventoryItem';
import type { ItemVariant } from '../types/itemVariant';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../types/itemVariant';

function sortActiveVariants(
  inventoryItem: InventoryItem | null | undefined
): ItemVariant[] {
  const raw = inventoryItem?.item?.item_variants ?? [];
  return [...raw]
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Default selection + unit pricing for a catalog listing (variant price + listing deal).
 */
export function useListingVariantSelection(
  inventoryItem: InventoryItem | null | undefined
) {
  const activeVariants = useMemo(
    () => sortActiveVariants(inventoryItem),
    [inventoryItem]
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
    const variants = sortActiveVariants(inventoryItem);
    if (variants.length === 0) {
      setSelectedVariantId(null);
      return;
    }
    if (variants.length === 1) {
      setSelectedVariantId(variants[0].id);
      return;
    }
    const def = variants.find((v) => v.is_default);
    setSelectedVariantId(def?.id ?? variants[0].id);
  }, [inventoryItem, variantIdsKey]);

  const selectedVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return activeVariants.find((v) => v.id === selectedVariantId) ?? null;
  }, [activeVariants, selectedVariantId]);

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
      inventoryItem.selling_price
    );
    return unitPriceWithListingDeal(
      base,
      inventoryItem.selling_price,
      inventoryItem.hasActiveDeal,
      inventoryItem.original_price,
      inventoryItem.discounted_price
    );
  }, [inventoryItem, selectedVariant]);

  const variantImageUrl = useMemo(
    () => primaryVariantImageUrl(selectedVariant),
    [selectedVariant]
  );

  return {
    activeVariants,
    selectedVariantId,
    setSelectedVariantId,
    selectedVariant,
    listingUnitPricing,
    variantImageUrl,
  };
}
