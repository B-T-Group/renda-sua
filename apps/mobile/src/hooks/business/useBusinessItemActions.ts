import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { businessApi } from '../../services/businessApi';
import type { BusinessCatalogItem, UpdateBusinessItemPayload } from '../../types/business/items';
import { normalizeCatalogItem } from '../../utils/businessItemUtils';

export function useBusinessItemActions(onSuccess?: () => void) {
  const { t } = useTranslation();
  const [actingId, setActingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const finish = useCallback(
    (message: string) => {
      setSnack(message);
      onSuccess?.();
      setActingId(null);
    },
    [onSuccess]
  );

  const fail = useCallback((e: unknown, fallback: string) => {
    setSnack(e instanceof Error ? e.message : fallback);
    setActingId(null);
  }, []);

  const updateItem = useCallback(
    async (itemId: string, body: UpdateBusinessItemPayload): Promise<BusinessCatalogItem | null> => {
      setActingId(itemId);
      try {
        const res = await businessApi.catalog.updateItem(itemId, body);
        finish(t('business.items.updated', 'Item updated'));
        return res.data?.item ? normalizeCatalogItem(res.data.item) : null;
      } catch (e: unknown) {
        fail(e, t('business.items.updateError', 'Failed to update item'));
        return null;
      }
    },
    [fail, finish, t]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      setActingId(itemId);
      try {
        await businessApi.catalog.deleteItem(itemId);
        finish(t('business.items.itemDeleted', 'Item deleted'));
      } catch (e: unknown) {
        fail(e, t('business.items.deleteError', 'Failed to delete item'));
        throw e;
      }
    },
    [fail, finish, t]
  );

  const setFavorite = useCallback(
    async (itemId: string, favorited: boolean) => {
      setActingId(itemId);
      try {
        await businessApi.catalog.setFavorite(itemId, favorited);
        finish(t('business.items.favoriteUpdated', 'Favorites updated'));
      } catch (e: unknown) {
        fail(e, t('business.items.favoriteUpdateError', 'Failed to update favorites'));
      }
    },
    [fail, finish, t]
  );

  const updateInventory = useCallback(
    async (
      inventoryId: string,
      body: {
        quantity?: number;
        is_active?: boolean;
        selling_price?: number;
        unit_cost?: number;
      }
    ) => {
      setActingId(inventoryId);
      try {
        await businessApi.catalog.updateInventory(inventoryId, body);
        finish(t('business.items.restockSuccess', 'Inventory updated'));
      } catch (e: unknown) {
        fail(e, t('business.items.restockError', 'Failed to update inventory'));
        throw e;
      }
    },
    [fail, finish, t]
  );

  return {
    actingId,
    snack,
    setSnack,
    updateItem,
    deleteItem,
    setFavorite,
    updateInventory,
  };
}
