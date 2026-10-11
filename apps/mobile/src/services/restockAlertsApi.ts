import { api } from './apiClient';

export interface RestockPreferences {
  push: boolean;
  whatsapp: boolean;
  sms: boolean;
}

export interface LikedItemWithAlert {
  id: string;
  item_id: string;
  item: {
    id: string;
    name: string;
    item_images?: Array<{ image_url: string; display_order?: number }>;
    currency: string;
  };
  business_location: {
    id: string;
    business_name: string;
  };
  price: number;
  available_quantity: number;
  alert_state: 'armed' | 'disarmed' | 'expired' | null;
  back_in_stock: boolean;
  restocked_at: string | null;
  quantity_left: number | null;
}

export interface RestockLikesResponse {
  items: LikedItemWithAlert[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function checkRestockAlertsEnabled(): Promise<boolean> {
  const res = await api.get<ApiEnvelope<{ enabled: boolean }>>(
    '/restock-alerts/status'
  );
  return res.data.enabled;
}

export async function getRestockPreferences(): Promise<RestockPreferences> {
  const res = await api.get<ApiEnvelope<RestockPreferences>>(
    '/restock-alerts/preferences'
  );
  return res.data;
}

export async function patchRestockPreferences(
  patch: Partial<RestockPreferences>
): Promise<RestockPreferences> {
  const res = await api.patch<ApiEnvelope<RestockPreferences>>(
    '/restock-alerts/preferences',
    patch
  );
  return res.data;
}

export async function setItemAlert(
  itemId: string,
  enabled: boolean
): Promise<{ enabled: boolean }> {
  const res = await api.put<ApiEnvelope<{ enabled: boolean }>>(
    `/restock-alerts/items/${itemId}`,
    { enabled }
  );
  return res.data;
}

export async function getLikesWithAlerts(
  filter: 'all' | 'back_in_stock' = 'all',
  page = 1,
  limit = 20
): Promise<RestockLikesResponse> {
  const res = await api.get<ApiEnvelope<RestockLikesResponse>>(
    `/restock-alerts/likes?filter=${filter}&page=${page}&limit=${limit}`
  );
  return res.data;
}

export async function stopRestockAlertsFromMessage(
  token: string
): Promise<{ stopped: boolean }> {
  const res = await api.post<ApiEnvelope<{ stopped: boolean }>>(
    '/restock-alerts/stop',
    { token }
  );
  return res.data;
}
