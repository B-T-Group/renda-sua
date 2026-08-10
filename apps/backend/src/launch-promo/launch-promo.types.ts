export type LaunchPromoSlotStatus = 'claimed' | 'confirmed' | 'released';

export interface LaunchPromoSlot {
  id: string;
  businessId: string;
  countryCode: string;
  status: LaunchPromoSlotStatus;
  ordersRemaining: number;
  claimedAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  businessLimit: number | null;
  zeroCommissionOrders: number | null;
  identificationWindowDays: number | null;
}
