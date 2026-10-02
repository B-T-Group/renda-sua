import { useEffect, useRef, useState } from 'react';
import type { CheckoutDiaspora } from '../utils/diasporaCheckout';
import { useApiClient } from './useApiClient';

export type CheckoutPreflightTaxNotice = 'calculated_at_checkout' | null;

export interface CheckoutPreflightRequest {
  items: Array<{
    business_inventory_id: string;
    quantity: number;
    item_variant_id?: string;
  }>;
  delivery_address_id?: string;
  fulfillment_method?: 'delivery' | 'pickup';
  payment_timing?: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
  phone_number?: string;
  mobile_payment_phone_id?: string;
  /** ISO 3166-1 alpha-2 billing country of the payer. */
  payer_country?: string;
  /** Set when the shopper is buying for a different recipient. */
  sending_to_someone_else?: boolean;
  recipient?: {
    name?: string;
    phone?: string;
    notify_whatsapp?: boolean;
  };
}

export interface CheckoutDeliveryAvailability {
  available: boolean;
  estimated_delivery_minutes: number | null;
}

export interface CheckoutPreflightGroup {
  business_id: string;
  business_name?: string;
  /** Present for every fulfillment so the client can decide whether to offer delivery. */
  delivery_availability?: CheckoutDeliveryAvailability | null;
  /** True when every item in this seller group supports store pickup. */
  pickup_eligible?: boolean;
  /** ISO 3166-1 alpha-2 country code of the seller primary location. */
  seller_country?: string;
  /** State/province of the seller primary location. */
  seller_state?: string;
  /** Business location id for this group, used to filter slots by operating hours. */
  business_location_id?: string;
  /** ISO 4217 currency the merchant is actually paid in. */
  currency?: string;
  /** Group total in the merchant currency. */
  total?: number;
  /** True when a MoMo reservation deposit is required. */
  deposit_required?: boolean;
  deposit_amount?: number;
  amount_due?: number;
  deposit_minimum_applied?: boolean;
  deposit_percent?: number | null;
  momo_pay_now_delivery_enabled?: boolean;
  /** True when every line is cooked food (kitchen wording); false for flagged-location goods. */
  all_cooked_food?: boolean;
  pay_after_merchant_confirm_eligible?: boolean;
}

export interface CookedFoodStoreClosedHourSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface CookedFoodStoreClosedDetails {
  timezone: string;
  next_opens_at: string | null;
  hours: CookedFoodStoreClosedHourSlot[];
}

export interface CheckoutPreflightBlocker {
  code: string;
  message: string;
  details?: CookedFoodStoreClosedDetails;
}

export interface CheckoutPreflightResult {
  tax_notice?: CheckoutPreflightTaxNotice;
  checkout_method?: 'STRIPE' | 'MOBILE_MONEY';
  can_proceed?: boolean;
  blocking_errors?: CheckoutPreflightBlocker[];
  groups?: CheckoutPreflightGroup[];
  /**
   * Payer-vs-recipient context. Null when the payer and the fulfillment market
   * resolve to the same rail and no recipient was declared.
   */
  diaspora?: CheckoutDiaspora | null;
  /**
   * Aggregated delivery availability, including before delivery is selected.
   * Offer delivery only when `available` is true.
   */
  delivery_availability?: CheckoutDeliveryAvailability | null;
  /** False when the cart includes cooked food (ASAP-only). */
  schedule_allowed?: boolean;
  schedule_required?: boolean;
  /** True when every group is MoMo pay-after (cooked food or flagged location; no deposit). */
  pay_after_merchant_confirm_eligible?: boolean;
  requires_payment_phone?: boolean;
  suggested_payment_phone?: string | null;
  suggested_payment_phone_id?: string | null;
  payment_phone_source?: 'registry' | 'profile' | 'none';
  purchase_credits?: {
    total: number;
    currency: string;
    allocations?: Array<{
      amount: number;
      applicability: string;
      businessId: string | null;
    }>;
  } | null;
}

export function useCheckoutPreflightState(
  request: CheckoutPreflightRequest | null,
  enabled = true
): { config: CheckoutPreflightResult | null; loading: boolean } {
  const apiClient = useApiClient();
  const [config, setConfig] = useState<CheckoutPreflightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef('');

  useEffect(() => {
    if (!enabled || !request || !apiClient) {
      setConfig(null);
      setLoading(false);
      return;
    }

    const requestId = JSON.stringify(request);
    requestIdRef.current = requestId;
    let cancelled = false;
    setLoading(true);

    void apiClient
      .post<CheckoutPreflightResult>('/orders/checkout/preflight', request)
      .then((response) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setConfig(response.data);
      })
      .catch(() => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setConfig(null);
      })
      .finally(() => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, enabled, request]);

  return { config, loading };
}

export function useCheckoutPreflight(
  request: CheckoutPreflightRequest | null,
  enabled = true
): CheckoutPreflightResult | null {
  return useCheckoutPreflightState(request, enabled).config;
}
