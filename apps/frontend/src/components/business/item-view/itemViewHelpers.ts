import { BusinessInventoryItem } from '../../../hooks/useBusinessInventory';
import { Item } from '../../../hooks/useItems';

export type ItemBusinessInventory = NonNullable<Item['business_inventories']>[0];
export type AnyInventory = BusinessInventoryItem | ItemBusinessInventory;

export type StockStatusColor = 'error' | 'warning' | 'success';

export interface StockStatus {
  label: 'outOfStock' | 'lowStock' | 'inStock';
  color: StockStatusColor;
  percentage: number;
}

export interface InventorySummary {
  totalAvailable: number;
  totalReserved: number;
  totalStock: number;
  locationsWithStock: number;
  locationsLowStock: number;
  locationsOutOfStock: number;
  totalLocations: number;
}

export function formatItemCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

export function formatItemDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStockStatus(inventory: AnyInventory): StockStatus {
  const available = inventory.computed_available_quantity;
  const reorderPoint = inventory.reorder_point;

  if (available === 0) {
    return { label: 'outOfStock', color: 'error', percentage: 0 };
  }
  if (available <= reorderPoint) {
    return {
      label: 'lowStock',
      color: 'warning',
      percentage: (available / (reorderPoint * 2)) * 100,
    };
  }
  return {
    label: 'inStock',
    color: 'success',
    percentage: Math.min((available / (reorderPoint * 2)) * 100, 100),
  };
}

export function buildInventorySummary(
  inventories: ItemBusinessInventory[] | undefined
): InventorySummary | null {
  if (!inventories) return null;
  return {
    totalAvailable: inventories.reduce(
      (sum, inv) => sum + inv.computed_available_quantity,
      0
    ),
    totalReserved: inventories.reduce(
      (sum, inv) => sum + inv.reserved_quantity,
      0
    ),
    totalStock: inventories.reduce((sum, inv) => sum + inv.quantity, 0),
    locationsWithStock: inventories.filter(
      (inv) => inv.computed_available_quantity > 0
    ).length,
    locationsLowStock: inventories.filter(
      (inv) =>
        inv.computed_available_quantity > 0 &&
        inv.computed_available_quantity <= inv.reorder_point
    ).length,
    locationsOutOfStock: inventories.filter(
      (inv) => inv.computed_available_quantity === 0
    ).length,
    totalLocations: inventories.length,
  };
}
