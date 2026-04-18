import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ItemPromotionPayload {
  promoted: boolean;
  start?: string;
  end?: string;
  sponsored?: boolean;
}

export function useItemPromotion() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);

  const setPromotion = useCallback(
    async (itemId: string, payload: ItemPromotionPayload) => {
      setLoading(true);
      try {
        await apiClient.patch(
          `/business-items/items/${itemId}/promotion`,
          payload
        );
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { setPromotion, loading };
}
