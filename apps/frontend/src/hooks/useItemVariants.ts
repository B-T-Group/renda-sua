import { useCallback } from 'react';
import type { ItemVariant } from '../types/itemVariant';
import { businessItemsApiParams } from '../utils/businessItemsApiParams';
import { useApiClient } from './useApiClient';

export interface CreateItemVariantPayload {
  name: string;
  sku?: string | null;
  price?: number | null;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  color?: string | null;
  attributes?: Record<string, unknown>;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export type UpdateItemVariantPayload = Partial<CreateItemVariantPayload>;

export interface CreateItemVariantImagePayload {
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
  display_order?: number;
  is_primary?: boolean;
}

export type UpdateItemVariantImagePayload =
  Partial<CreateItemVariantImagePayload>;

export class VariantApiError extends Error {
  status?: number;
  isSkuConflict: boolean;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'VariantApiError';
    this.status = status;
    this.isSkuConflict = status === 409;
  }
}

function toVariantApiError(error: {
  response?: { status?: number; data?: { error?: string; message?: string } };
  message?: string;
}): VariantApiError {
  const status = error?.response?.status;
  const message =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    'Request failed';
  return new VariantApiError(String(message), status);
}

export function useItemVariants(itemId: string | null) {
  const apiClient = useApiClient();

  const listVariants = useCallback(async (): Promise<ItemVariant[]> => {
    if (!apiClient || !itemId) return [];
    const res = await apiClient.get<{ success: boolean; data: ItemVariant[] }>(
      `/business-items/items/${itemId}/variants`
    );
    return res.data.success ? res.data.data ?? [] : [];
  }, [apiClient, itemId]);

  const createVariant = useCallback(
    async (payload: CreateItemVariantPayload): Promise<ItemVariant> => {
      if (!apiClient || !itemId) {
        throw new VariantApiError('API client not available');
      }
      try {
        const res = await apiClient.post<{
          success: boolean;
          data: ItemVariant;
          error?: string;
        }>(`/business-items/items/${itemId}/variants`, payload);
        if (!res.data.success || !res.data.data) {
          throw new VariantApiError(res.data.error || 'Failed to create variant');
        }
        return res.data.data;
      } catch (error: any) {
        if (error instanceof VariantApiError) throw error;
        throw toVariantApiError(error);
      }
    },
    [apiClient, itemId]
  );

  const updateVariant = useCallback(
    async (
      variantId: string,
      payload: UpdateItemVariantPayload
    ): Promise<ItemVariant> => {
      if (!apiClient) {
        throw new VariantApiError('API client not available');
      }
      try {
        const res = await apiClient.patch<{
          success: boolean;
          data: ItemVariant;
          error?: string;
        }>(`/item-variants/${variantId}`, payload);
        if (!res.data.success || !res.data.data) {
          throw new VariantApiError(res.data.error || 'Failed to update variant');
        }
        return res.data.data;
      } catch (error: any) {
        if (error instanceof VariantApiError) throw error;
        throw toVariantApiError(error);
      }
    },
    [apiClient]
  );

  const deleteVariant = useCallback(
    async (variantId: string): Promise<boolean> => {
      if (!apiClient) return false;
      const res = await apiClient.delete<{ success: boolean }>(
        `/item-variants/${variantId}`
      );
      return res.data.success === true;
    },
    [apiClient]
  );

  const setDefaultVariant = useCallback(
    async (variantId: string): Promise<ItemVariant | null> => {
      if (!apiClient) return null;
      const res = await apiClient.post<{ success: boolean; data: ItemVariant }>(
        `/item-variants/${variantId}/set-default`,
        {}
      );
      return res.data.success ? res.data.data : null;
    },
    [apiClient]
  );

  const addVariantImage = useCallback(
    async (
      variantId: string,
      payload: CreateItemVariantImagePayload
    ): Promise<unknown | null> => {
      if (!apiClient) return null;
      const res = await apiClient.post<{ success: boolean; data: unknown }>(
        `/item-variants/${variantId}/images`,
        payload
      );
      return res.data.success ? res.data.data : null;
    },
    [apiClient]
  );

  const updateVariantImage = useCallback(
    async (
      imageId: string,
      payload: UpdateItemVariantImagePayload
    ): Promise<unknown | null> => {
      if (!apiClient) return null;
      const res = await apiClient.patch<{ success: boolean; data: unknown }>(
        `/item-variant-images/${imageId}`,
        payload
      );
      return res.data.success ? res.data.data : null;
    },
    [apiClient]
  );

  const deleteVariantImage = useCallback(
    async (imageId: string): Promise<boolean> => {
      if (!apiClient) return false;
      const res = await apiClient.delete<{ success: boolean }>(
        `/item-variant-images/${imageId}`
      );
      return res.data.success === true;
    },
    [apiClient]
  );

  const setVariantPriceOverrides = useCallback(
    async (
      inventoryId: string,
      overrides: Array<{
        item_variant_id: string;
        selling_price: number | null;
      }>,
      businessId?: string
    ): Promise<boolean> => {
      if (!apiClient || !inventoryId) return false;
      const res = await apiClient.put<{ success: boolean }>(
        `/business-items/inventory/${inventoryId}/variant-price-overrides`,
        { overrides },
        businessItemsApiParams(businessId)
      );
      return res.data.success === true;
    },
    [apiClient]
  );

  return {
    listVariants,
    createVariant,
    updateVariant,
    deleteVariant,
    setDefaultVariant,
    addVariantImage,
    updateVariantImage,
    deleteVariantImage,
    setVariantPriceOverrides,
  };
}
