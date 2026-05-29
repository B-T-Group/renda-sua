import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useDistanceMatrix } from './useDistanceMatrix';
import { businessItemsApiParams } from '../utils/businessItemsApiParams';

export interface BusinessItemsPageData {
  items: any[];
  business_locations: any[];
  available_items: any[];
}

/** Avoid refetching full page-data when returning from item view within this window. */
const PAGE_DATA_STALE_MS = 2 * 60 * 1000;

export function useBusinessItemsPageData(businessId?: string) {
  const apiClient = useApiClient();
  const { fetchDistanceMatrix } = useDistanceMatrix();
  const [items, setItems] = useState<any[]>([]);
  const [businessLocations, setBusinessLocations] = useState<any[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<{ businessId: string; at: number } | null>(null);
  const hasCachedDataRef = useRef(false);

  const refetch = useCallback(async (force = false) => {
    if (!businessId) return;

    const now = Date.now();
    const last = lastFetchRef.current;
    if (
      !force &&
      last?.businessId === businessId &&
      now - last.at < PAGE_DATA_STALE_MS &&
      hasCachedDataRef.current
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: BusinessItemsPageData;
      }>('/business-items/page-data', businessItemsApiParams(businessId));

      const data = response.data?.data;
      if (!data) {
        setItems([]);
        setBusinessLocations([]);
        setAvailableItems([]);
        return;
      }

      setBusinessLocations(data.business_locations ?? []);
      setAvailableItems(data.available_items ?? []);

      const fetchedItems = data.items ?? [];
      const allAddressIds = fetchedItems
        .flatMap((item: any) =>
          (item.business_inventories || []).map((inv: any) =>
            String(inv.business_location?.address_id)
          )
        )
        .filter(Boolean);
      const uniqueAddressIds: string[] = Array.from(new Set(allAddressIds));

      let distanceMatrix: any = null;
      if (uniqueAddressIds.length > 0) {
        try {
          distanceMatrix = await fetchDistanceMatrix({
            destination_address_ids: uniqueAddressIds,
          });
        } catch (e) {
          console.warn('Failed to fetch distance matrix:', e);
        }
      }

      const updatedItems = fetchedItems.map((item: any) => {
        let estDeliveryTime: string | null = null;
        let estDistance: string | null = null;
        const addressId =
          item.business_inventories?.[0]?.business_location?.address_id;
        if (distanceMatrix && addressId) {
          const idx = distanceMatrix.destination_ids.indexOf(addressId);
          if (idx !== -1 && distanceMatrix.rows[0]?.elements[idx]) {
            const el = distanceMatrix.rows[0].elements[idx];
            estDeliveryTime = el.duration?.text || null;
            estDistance = el.distance?.text || null;
          }
        }
        return {
          ...item,
          estimated_delivery_time_text: estDeliveryTime,
          estimated_distance_text: estDistance,
        };
      });
      setItems(updatedItems);
      hasCachedDataRef.current = updatedItems.length > 0;
      lastFetchRef.current = { businessId, at: Date.now() };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch page data');
      setItems([]);
      setBusinessLocations([]);
      setAvailableItems([]);
      hasCachedDataRef.current = false;
      lastFetchRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [businessId, apiClient, fetchDistanceMatrix]);

  const mergeItemIntoList = useCallback((itemId: string, updates: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          ...updates,
          estimated_delivery_time_text:
            updates.estimated_delivery_time_text ??
            it.estimated_delivery_time_text,
          estimated_distance_text:
            updates.estimated_distance_text ?? it.estimated_distance_text,
          is_favorite: updates.is_favorite ?? it.is_favorite,
        };
      })
    );
  }, []);

  const refreshListItem = useCallback(
    async (itemId: string) => {
      if (!businessId) return;
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: { item: any };
        }>(`/business-items/items/${itemId}`, businessItemsApiParams(businessId));
        const fresh = response.data?.data?.item;
        if (!fresh) return;
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== itemId) return it;
            return {
              ...fresh,
              is_favorite: it.is_favorite,
              estimated_delivery_time_text: it.estimated_delivery_time_text,
              estimated_distance_text: it.estimated_distance_text,
            };
          })
        );
      } catch (e) {
        console.warn('refreshListItem: failed to fetch item', e);
      }
    },
    [apiClient, businessId]
  );

  useEffect(() => {
    if (businessId) {
      void refetch();
    } else {
      setItems([]);
      setBusinessLocations([]);
      setAvailableItems([]);
      lastFetchRef.current = null;
      hasCachedDataRef.current = false;
    }
  }, [businessId, refetch]);

  return {
    items,
    businessLocations,
    availableItems,
    loading,
    error,
    refetch,
    mergeItemIntoList,
    refreshListItem,
  };
}
