import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface CommerceIntegration {
  id: string;
  businessId: string;
  provider: string;
  shopDomain: string;
  displayName: string | null;
  status: string;
  scopes: string | null;
  featureFlags: Record<string, unknown>;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommerceExternalLocation {
  externalId: string;
  name: string;
  active: boolean;
  address?: string;
  mapping: {
    internalId: string;
    syncEnabled: boolean;
    mappingId: string;
  } | null;
}

export interface CommerceProductPreview {
  externalId: string;
  title: string;
  description?: string;
  imageUrls: string[];
  variants: Array<{
    externalId: string;
    title: string;
    sku?: string;
    price?: number;
  }>;
  alreadyMapped: boolean;
  duplicateCandidates: Array<{ sku: string; itemId: string } | null>;
}

export function useCommerceIntegrations() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: CommerceIntegration[];
      }>('/commerce-integrations');
      return res.data.data ?? [];
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load integrations');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const startShopifyInstall = useCallback(
    async (shopDomain: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post<{
          success: boolean;
          data: { authorizationUrl: string };
        }>('/commerce-integrations/shopify/install', { shopDomain });
        return res.data.data.authorizationUrl;
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
            err?.message ||
            'Failed to start Shopify connect'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const disconnect = useCallback(
    async (integrationId: string) => {
      await apiClient.delete(`/commerce-integrations/${integrationId}`);
    },
    [apiClient]
  );

  const listLocations = useCallback(
    async (integrationId: string) => {
      const res = await apiClient.get<{
        success: boolean;
        data: CommerceExternalLocation[];
      }>(`/commerce-integrations/${integrationId}/locations`);
      return res.data.data ?? [];
    },
    [apiClient]
  );

  const saveLocationMappings = useCallback(
    async (
      integrationId: string,
      mappings: Array<{
        externalId: string;
        internalId: string | null;
        syncEnabled: boolean;
      }>
    ) => {
      await apiClient.put(
        `/commerce-integrations/${integrationId}/location-mappings`,
        { mappings }
      );
    },
    [apiClient]
  );

  const previewProducts = useCallback(
    async (integrationId: string, cursor?: string) => {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const res = await apiClient.get<{
        success: boolean;
        data: {
          nextCursor: string | null;
          products: CommerceProductPreview[];
        };
      }>(`/commerce-integrations/${integrationId}/products/preview${qs}`);
      return res.data.data;
    },
    [apiClient]
  );

  const importProducts = useCallback(
    async (integrationId: string, externalProductIds: string[]) => {
      const res = await apiClient.post<{
        success: boolean;
        data: {
          runId: string;
          status: string;
          results: Array<{
            externalId: string;
            success: boolean;
            itemId?: string;
            error?: string;
          }>;
        };
      }>(`/commerce-integrations/${integrationId}/products/import`, {
        externalProductIds,
        importInventory: true,
      });
      return res.data.data;
    },
    [apiClient]
  );

  const syncNow = useCallback(
    async (integrationId: string) => {
      await apiClient.post(`/commerce-integrations/${integrationId}/sync`, {});
    },
    [apiClient]
  );

  const listSyncRuns = useCallback(
    async (integrationId: string) => {
      const res = await apiClient.get<{
        success: boolean;
        data: Array<{
          id: string;
          trigger: string;
          status: string;
          started_at: string;
          completed_at: string | null;
          error: string | null;
        }>;
      }>(`/commerce-integrations/${integrationId}/sync-runs`);
      return res.data.data ?? [];
    },
    [apiClient]
  );

  return {
    loading,
    error,
    listIntegrations,
    startShopifyInstall,
    disconnect,
    listLocations,
    saveLocationMappings,
    previewProducts,
    importProducts,
    syncNow,
    listSyncRuns,
  };
}
