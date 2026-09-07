import { apiRequest } from './apiClient';

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

export async function submitProductInterest(
  businessInventoryId: string,
  note?: string
): Promise<unknown> {
  const res = await apiRequest<{ success: boolean; data: unknown }>(
    '/product-interest',
    {
      method: 'POST',
      body: JSON.stringify({
        businessInventoryId,
        note: note?.trim() || undefined,
      }),
    }
  );
  return res.data;
}

export async function fetchClientProductInterest(
  page = 1,
  limit = 20
): Promise<ProductInterestPage> {
  const res = await apiRequest<{ success: boolean; data: ProductInterestPage }>(
    `/product-interest/client?page=${page}&limit=${limit}`,
    { method: 'GET' }
  );
  return res.data;
}

export async function fetchBusinessProductInterest(
  page = 1,
  limit = 20,
  locationId?: string
): Promise<ProductInterestPage> {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (locationId) q.set('locationId', locationId);
  const res = await apiRequest<{ success: boolean; data: ProductInterestPage }>(
    `/product-interest/business?${q.toString()}`,
    { method: 'GET' }
  );
  return res.data;
}
