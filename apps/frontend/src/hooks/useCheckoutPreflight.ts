import { useEffect, useRef, useState } from 'react';
import type { DedicatedCoveredSlot } from '../utils/checkoutPresentation';
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
  /** #594 (flag on only): ASAP delivery passes today's rules; same value as `available`. */
  delivery_asap_available?: boolean;
  /** #594 (flag on only): scheduled slots a dedicated agent covers when ASAP is unavailable. */
  dedicated_covered_slots?: DedicatedCoveredSlot[];
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
  /** Flat service fee included in total. 0 when this seller country has no fee. */
  service_fee?: number;
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
  /** False (or omitted) when MoMo pay-now + delivery is blocked in this market. */
  momo_pay_now_delivery_enabled?: boolean | null;
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
  enabled = true,
  /** Bump to re-run the same preflight (e.g. after DELIVERY_UNAVAILABLE on create). */
  refreshKey = 0
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

    const requestId = `${refreshKey}:${JSON.stringify(request)}`;
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
  }, [apiClient, enabled, request, refreshKey]);

  return { config, loading };
}

export function useCheckoutPreflight(
  request: CheckoutPreflightRequest | null,
  enabled = true,
  refreshKey = 0
): CheckoutPreflightResult | null {
  return useCheckoutPreflightState(request, enabled, refreshKey).config;
}
