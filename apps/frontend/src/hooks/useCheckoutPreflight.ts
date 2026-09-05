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
  /** Null when fulfillment is pickup. */
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
}

export interface CheckoutPreflightBlocker {
  code: string;
  message: string;
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
   * Aggregated delivery availability. Null when fulfillment is pickup.
   * When `available` is false, show the generic "Delivery is currently
   * unavailable." message and steer the user to store pickup.
   */
  delivery_availability?: CheckoutDeliveryAvailability | null;
}

export function useCheckoutPreflight(
  request: CheckoutPreflightRequest | null,
  enabled = true
): CheckoutPreflightResult | null {
  const apiClient = useApiClient();
  const [config, setConfig] = useState<CheckoutPreflightResult | null>(null);
  const requestIdRef = useRef('');

  useEffect(() => {
    if (!enabled || !request || !apiClient) {
      setConfig(null);
      return;
    }

    const requestId = JSON.stringify(request);
    requestIdRef.current = requestId;
    let cancelled = false;

    void apiClient
      .post<CheckoutPreflightResult>('/orders/checkout/preflight', request)
      .then((response) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setConfig(response.data);
      })
      .catch(() => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, enabled, request]);

  return config;
}
