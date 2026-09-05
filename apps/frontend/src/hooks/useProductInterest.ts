import { useCallback } from 'react';
import { useApiClient } from './useApiClient';

export interface ProductInterestRow {
  id: string;
  client_note?: string | null;
  status: string;
  created_at: string;
  business_inventory_id: string;
  business_location_id: string;
  item?: { id: string; name: string } | null;
  business_location?: { id: string; name: string } | null;
  business?: { id: string; name: string } | null;
  client_user?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
  } | null;
}

export interface ProductInterestPage {
  items: ProductInterestRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useProductInterest() {
  const api = useApiClient();

  const submitInterest = useCallback(
    async (businessInventoryId: string, note?: string) => {
      const res = await api.post('/product-interest', {
        businessInventoryId,
        note: note?.trim() || undefined,
      });
      return res.data?.data;
    },
    [api]
  );

  const listClient = useCallback(
    async (page = 1, limit = 20): Promise<ProductInterestPage> => {
      const res = await api.get('/product-interest/client', {
        params: { page, limit },
      });
      return res.data?.data;
    },
    [api]
  );

  const listBusiness = useCallback(
    async (
      page = 1,
      limit = 20,
      locationId?: string
    ): Promise<ProductInterestPage> => {
      const res = await api.get('/product-interest/business', {
        params: { page, limit, locationId: locationId || undefined },
      });
      return res.data?.data;
    },
    [api]
  );

  return { submitInterest, listClient, listBusiness };
}
