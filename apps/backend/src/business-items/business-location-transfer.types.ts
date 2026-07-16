export type TransferRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type TransferMode = 'location_ownership' | 'inventory_merge';

export interface TransferBusinessOption {
  id: string;
  name: string;
  email: string;
}

export interface TransferSkipItem {
  itemId: string;
  sku?: string | null;
  name: string;
}

export interface TransferRequestMetadata {
  [key: string]: unknown;
  skippedDuplicates?: TransferSkipItem[];
  skippedShared?: TransferSkipItem[];
  movedItemIds?: string[];
  movedRentalItemIds?: string[];
  movedListingIds?: string[];
}

export interface TransferPreview {
  locationId: string;
  locationName: string;
  fromBusiness: TransferBusinessOption;
  toBusiness: TransferBusinessOption;
  mode: TransferMode;
  toLocation?: { id: string; name: string } | null;
  itemCount: number;
  rentalItemCount: number;
  movableItemCount: number;
  movableRentalItemCount: number;
  skippedDuplicateCount: number;
  skippedSharedCount: number;
  skippedDuplicates: TransferSkipItem[];
  skippedShared: TransferSkipItem[];
  orderCount: number;
  completedOrderCount: number;
  canTransfer: boolean;
  blockReasons: string[];
}

export interface TransferRequestRow {
  id: string;
  business_location_id: string;
  from_business_id: string;
  to_business_id: string;
  to_business_location_id?: string | null;
  transfer_mode?: TransferMode;
  from_user_id: string;
  to_user_id: string;
  requested_by_user_id: string;
  status: TransferRequestStatus;
  item_count: number;
  rental_item_count: number;
  order_count: number;
  metadata: TransferRequestMetadata;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  business_location?: { id: string; name: string };
  to_business_location?: { id: string; name: string } | null;
  from_business?: { id: string; name: string; user?: { email?: string } };
  to_business?: { id: string; name: string; user?: { email?: string } };
  requested_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface MergeClassification {
  movableItemIds: string[];
  movableRentalItemIds: string[];
  movableListingIds: string[];
  skippedDuplicates: TransferSkipItem[];
  skippedShared: TransferSkipItem[];
}
