/** Réponse GET `/orders/item/:itemId/deliveryFee` (alignée web `useDeliveryFee`). */

export interface ItemDeliveryFeeResponse {
  success: boolean;
  deliveryFee: number;
  isFirstOrderClient?: boolean;
  baseDeliveryFeeBeforeDiscount?: number;
  firstOrderBaseDeliveryDiscountAmount?: number;
  baseDeliveryFee?: number;
  perKmDeliveryFee?: number;
  distance?: number;
  method: 'distance_based' | 'flat_fee';
  currency: string;
  message?: string;
}

export interface DiscountCodeValidateResponse {
  valid: boolean;
  discountPercentage: number;
  message: string;
}
