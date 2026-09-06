export type AdminCatalogModerationStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'ai_reviewing'
  | 'proposal_pending';

export interface AdminCatalogItemsQuery {
  q?: string;
  businessId?: string;
  from?: string;
  to?: string;
  moderationStatus?: AdminCatalogModerationStatus;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminCatalogItemListRow {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  currency: string | null;
  isActive: boolean;
  moderationStatus: string | null;
  createdAt: string | null;
  business: { id: string; name: string } | null;
  thumbnailUrl: string | null;
}

export interface AdminCatalogItemsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminCatalogItemsListResult {
  items: AdminCatalogItemListRow[];
  pagination: AdminCatalogItemsPagination;
}

export interface AdminCatalogItemImage {
  id: string;
  imageUrl: string | null;
  originalUrl: string | null;
  rembgUrl: string | null;
  enhancedUrl: string | null;
  activeVersion: string;
  displayOrder: number;
  isAiCleaned: boolean;
  isRembgCleaned: boolean;
}

export interface AdminCatalogItemDetail {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  price: number | null;
  currency: string | null;
  isActive: boolean;
  moderationStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  weight: number | null;
  weightUnit: string | null;
  dimensions: string | null;
  model: string | null;
  color: string | null;
  brandId: string | null;
  itemSubCategoryId: number | null;
  isFragile: boolean;
  isPerishable: boolean;
  isUsed: boolean;
  requiresSpecialHandling: boolean;
  minOrderQuantity: number | null;
  maxOrderQuantity: number | null;
  payOnDeliveryEnabled: boolean;
  payAtPickupEnabled: boolean;
  business: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  itemSubCategory: {
    id: number;
    name: string;
    item_category?: { id: number; name: string } | null;
  } | null;
  images: AdminCatalogItemImage[];
}

export interface AdminCatalogItemUpdatePayload {
  name?: string;
  description?: string;
  price?: number | null;
  currency?: string;
  sku?: string | null;
  is_active?: boolean;
}

export interface AdminCleanupSelection {
  imageId: string;
  kind: 'rembg' | 'ai';
}
