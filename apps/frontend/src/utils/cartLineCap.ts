import { cartLineKey } from '../contexts/cartLineKey';
import { lineQuantityCap, packQuantityOf } from '../types/itemVariant';

type CapLine = {
  inventoryItemId: string;
  variantId?: string;
  quantity: number;
  itemData: {
    packQuantity?: number;
    maxOrderQuantity?: number;
    availableQuantity?: number;
  };
};

/** Line quantity after pack size, shared stock, and max order. */
export function cappedCartQuantity(
  line: CapLine,
  nextQuantity: number,
  lines: CapLine[]
): number {
  const key = cartLineKey(line.inventoryItemId, line.variantId);
  const other = otherBaseUnits(line.inventoryItemId, key, lines);
  const cap = lineQuantityCap({
    packQuantity: line.itemData.packQuantity,
    maxOrderBaseUnits: line.itemData.maxOrderQuantity,
    availableBaseUnits: line.itemData.availableQuantity,
    otherLinesBaseUnits: other,
  });
  if (cap == null) return nextQuantity;
  return Math.min(nextQuantity, Math.max(0, cap));
}

function otherBaseUnits(
  inventoryItemId: string,
  lineKey: string,
  lines: CapLine[]
): number {
  return lines
    .filter((row) => row.inventoryItemId === inventoryItemId)
    .filter((row) => cartLineKey(row.inventoryItemId, row.variantId) !== lineKey)
    .reduce(
      (sum, row) =>
        sum + row.quantity * packQuantityOf({ quantity: row.itemData.packQuantity }),
      0
    );
}
