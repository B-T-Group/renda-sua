import { useEffect, useRef, useState } from 'react';
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
}

export interface CheckoutPreflightResult {
  tax_notice?: CheckoutPreflightTaxNotice;
  checkout_method?: 'STRIPE' | 'MOBILE_MONEY';
  can_proceed?: boolean;
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
