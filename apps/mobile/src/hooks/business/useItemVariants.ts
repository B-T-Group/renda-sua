import { useCallback, useEffect, useState } from 'react';
import { businessApi } from '@/services/businessApi';
import type {
  ItemVariant,
  ItemVariantInput,
} from '@/types/business/itemVariant';

export function useItemVariants(itemId: string) {
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await businessApi.variants.list(itemId);
      setVariants(response.data ?? []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Failed to load variants');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = useCallback(
    async (input: ItemVariantInput, variantId?: string) => {
      const response = variantId
        ? await businessApi.variants.update(variantId, input)
        : await businessApi.variants.create(itemId, input);
      await refetch();
      return response.data;
    },
    [itemId, refetch]
  );

  const remove = useCallback(async (variantId: string) => {
    await businessApi.variants.delete(variantId);
    await refetch();
  }, [refetch]);

  const setDefault = useCallback(async (variantId: string) => {
    await businessApi.variants.setDefault(variantId);
    await refetch();
  }, [refetch]);

  return { variants, loading, error, refetch, save, remove, setDefault };
}
