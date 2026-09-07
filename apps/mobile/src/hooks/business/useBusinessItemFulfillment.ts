import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchBusinessItemDetail,
  updateBusinessItemFields,
} from '../../services/businessItemFormService';
import type { UpdateBusinessItemPayload } from '../../types/business/items';
import { parseShippingPrice } from '../../utils/itemFulfillment';

function fulfillmentPayload(input: {
  pickupEnabled: boolean;
  shippingEnabled: boolean;
  shippingPrice: string;
  currency: string;
}): UpdateBusinessItemPayload | null {
  const price = parseShippingPrice(input.shippingPrice);
  if (input.shippingEnabled && price == null) return null;
  return {
    pay_at_pickup_enabled: input.pickupEnabled,
    shipping_enabled: input.shippingEnabled,
    ...(input.shippingEnabled
      ? { shipping_price: price, shipping_currency: input.currency }
      : {}),
  };
}

export function useBusinessItemFulfillment(itemId: string) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('XAF');
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [shippingPrice, setShippingPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const item = await fetchBusinessItemDetail(itemId);
      setCurrency(item.currency || 'XAF');
      setPickupEnabled(item.pay_at_pickup_enabled !== false);
      setShippingEnabled(Boolean(item.shipping_enabled));
      setShippingPrice(
        item.shipping_price != null ? String(item.shipping_price) : ''
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : t('business.items.loadError', 'Failed to load item');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [itemId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    const payload = fulfillmentPayload({
      pickupEnabled,
      shippingEnabled,
      shippingPrice,
      currency,
    });
    if (!payload) {
      setError(
        t(
          'business.items.fulfillment.shippingPriceRequired',
          'Enter a shipping price. Use 0 for free shipping.'
        )
      );
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      await updateBusinessItemFields(itemId, payload);
      return true;
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : t('business.items.updateError', 'Failed to update item');
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [currency, itemId, pickupEnabled, shippingEnabled, shippingPrice, t]);

  return {
    loading,
    saving,
    error,
    currency,
    pickupEnabled,
    shippingEnabled,
    shippingPrice,
    setPickupEnabled,
    setShippingEnabled,
    setShippingPrice,
    save,
    dismissError: () => setError(null),
  };
}
