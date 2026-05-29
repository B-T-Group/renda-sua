import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';
import { businessItemsApiParams } from '../utils/businessItemsApiParams';

export interface ItemPromotionPayload {
  promoted: boolean;
  start?: string;
  end?: string;
  sponsored?: boolean;
}

export function useItemPromotion(businessId?: string) {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);

  const setPromotion = useCallback(
    async (itemId: string, payload: ItemPromotionPayload) => {
      setLoading(true);
      try {
        await apiClient.patch(
          `/business-items/items/${itemId}/promotion`,
          payload,
          businessItemsApiParams(businessId)
        );
      } finally {
        setLoading(false);
      }
    },
    [apiClient, businessId]
  );

  return { setPromotion, loading };
}
