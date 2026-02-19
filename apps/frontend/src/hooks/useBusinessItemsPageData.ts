import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useDistanceMatrix } from './useDistanceMatrix';

export interface BusinessItemsPageData {
  items: any[];
  business_locations: any[];
  available_items: any[];
}

export function useBusinessItemsPageData(businessId?: string) {
  const apiClient = useApiClient();
  const { fetchDistanceMatrix } = useDistanceMatrix();
  const [items, setItems] = useState<any[]>([]);
  const [businessLocations, setBusinessLocations] = useState<any[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: BusinessItemsPageData;
      }>('/business-items/page-data');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch page data');
      setItems([]);
      setBusinessLocations([]);
      setAvailableItems([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, apiClient, fetchDistanceMatrix]);

  useEffect(() => {
    if (businessId) {
      refetch();
    } else {
      setItems([]);
      setBusinessLocations([]);
      setAvailableItems([]);
    }
  }, [businessId, refetch]);

  return {
    items,
    businessLocations,
    availableItems,
    loading,
    error,
    refetch,
  };
}
