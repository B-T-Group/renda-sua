export interface TopViewedProduct {
  inventoryItemId: string;
  itemId: string;
  itemName: string;
  imageUrl: string | null;
  viewsCount: number;
}

export interface DashboardAggregates {
  ordersTotal: number;
  ordersByStatus: Record<string, number>;
  pendingCashReconciliationCount: number;
  itemCount: number;
  rentalItemCount: number;
  locationCount: number;
  inventoryCount: number;
  pendingFailedDeliveriesCount: number;
  /** Distinct clients who ordered or rented from this business. */
  uniqueClientCount: number;
  totalProductViews: number;
  productViewsLast7d: number;
  topViewedProducts: TopViewedProduct[];
  approvedItemCount?: number;
  approvedRentalCount?: number;
  hasLogo?: boolean;
  hasOperatingHours?: boolean;
  lastCatalogItemAt?: string | null;
  itemsNeedingAiCleanupCount?: number;
  pendingItemCount?: number;
  rejectedItemCount?: number;
  topViewedOutOfStockCount?: number;
  tipsRemindersEnabled?: boolean;
}

export interface DashboardAggregatesResponse {
  success: boolean;
  data: DashboardAggregates;
}
