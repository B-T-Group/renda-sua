import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useApiClient } from './useApiClient';

export interface ItemDeal {
  id: string;
  inventory_item_id: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_at: string;
  end_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useItemDeals = (inventoryItemId: string | null) => {
  const apiClient = useApiClient();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const [deals, setDeals] = useState<ItemDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    if (!inventoryItemId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        `/business-items/${inventoryItemId}/deals`
      );
      if (response.data.success) {
        setDeals(response.data.data?.deals ?? []);
      } else {
        setError(response.data.error || 'Failed to load deals');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        t('business.items.deals.loadError', 'Failed to load deals');
      setError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [apiClient, inventoryItemId, enqueueSnackbar, t]);

  useEffect(() => {
    void fetchDeals();
  }, [fetchDeals]);

  const createDeal = useCallback(
    async (payload: {
      discountType: 'percentage' | 'fixed';
      discountValue: number;
      startAt: string;
      endAt: string;
    }) => {
      if (!inventoryItemId) return;
      try {
        const response = await apiClient.post(
          `/business-items/${inventoryItemId}/deals`,
          payload
        );
        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to create deal');
        }
        enqueueSnackbar(
          t('business.items.deals.created', 'Deal created successfully'),
          { variant: 'success' }
        );
        await fetchDeals();
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          err?.message ||
          t('business.items.deals.createError', 'Failed to create deal');
        enqueueSnackbar(message, { variant: 'error' });
        throw err;
      }
    },
    [apiClient, inventoryItemId, enqueueSnackbar, fetchDeals, t]
  );

  const updateDeal = useCallback(
    async (
      dealId: string,
      updates: {
        discountType?: 'percentage' | 'fixed';
        discountValue?: number;
        startAt?: string;
        endAt?: string;
        isActive?: boolean;
      }
    ) => {
      try {
        const response = await apiClient.post(
          `/business-items/deals/${dealId}`,
          updates
        );
        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to update deal');
        }
        enqueueSnackbar(
          t('business.items.deals.updated', 'Deal updated successfully'),
          { variant: 'success' }
        );
        await fetchDeals();
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          err?.message ||
          t('business.items.deals.updateError', 'Failed to update deal');
        enqueueSnackbar(message, { variant: 'error' });
        throw err;
      }
    },
    [apiClient, enqueueSnackbar, fetchDeals, t]
  );

  const deleteDeal = useCallback(
    async (dealId: string) => {
      try {
        await apiClient.delete(`/business-items/deals/${dealId}`);
        enqueueSnackbar(
          t('business.items.deals.deleted', 'Deal deleted successfully'),
          { variant: 'success' }
        );
        await fetchDeals();
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          err?.message ||
          t('business.items.deals.deleteError', 'Failed to delete deal');
        enqueueSnackbar(message, { variant: 'error' });
        throw err;
      }
    },
    [apiClient, enqueueSnackbar, fetchDeals, t]
  );

  return {
    deals,
    loading,
    error,
    refetch: fetchDeals,
    createDeal,
    updateDeal,
    deleteDeal,
  };
};

