export type TransferBusinessOption = {
  id: string;
  name: string;
  email: string;
};

export type TransferMode = 'location_ownership' | 'inventory_merge';

export type TransferSkipItem = {
  itemId: string;
  sku?: string | null;
  name: string;
};

export type TransferPreview = {
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
};

export type TransferRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type TransferRequest = {
  id: string;
  business_location_id: string;
  from_business_id: string;
  to_business_id: string;
  to_business_location_id?: string | null;
  transfer_mode?: TransferMode;
  status: TransferRequestStatus | string;
  item_count: number;
  rental_item_count: number;
  order_count: number;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
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
  metadata?: Record<string, unknown>;
};
