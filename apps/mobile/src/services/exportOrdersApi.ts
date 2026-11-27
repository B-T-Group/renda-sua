import { apiRequest } from './apiClient';

export interface ExportOrderSummary {
  id: string;
  status: string;
  bc_number?: string | null;
  created_at: string;
  business?: { id: string; name: string } | null;
}

export interface ExportOrderPage {
  items: ExportOrderSummary[];
  total: number;
}

export async function fetchMyExportOrders(page = 1, limit = 50): Promise<ExportOrderPage> {
  const res = await apiRequest<{ success: boolean; data: ExportOrderPage }>(
    `/export-orders/mine?page=${page}&limit=${limit}`,
    { method: 'GET' }
  );
  return res.data;
}
