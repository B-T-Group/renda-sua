import { apiRequest } from './apiClient';

export interface ExportOrderLine {
  id: string;
  product_name: string;
  quantity: number;
  business_inventory_id?: string | null;
}

export interface ExportOrderDocument {
  id: string;
  doc_type: string;
  document_number: string;
}

export interface ExportOrderRow {
  id: string;
  bc_number: string;
  status: string;
  created_at?: string;
  lines?: ExportOrderLine[];
}

export interface ExportOrderDetail extends ExportOrderRow {
  documents?: ExportOrderDocument[];
}

export interface ExportOrderPage {
  items: ExportOrderRow[];
  total: number;
  page: number;
  limit: number;
}

export type BalanceOption = 'FULL' | 'FINANCED_30' | 'FINANCED_60';
export type ProformaAction = 'approve' | 'request_adjustment';

interface Envelope<T> {
  success: boolean;
  data: T;
}

const post = <T>(path: string, body: unknown) =>
  apiRequest<Envelope<T>>(path, { method: 'POST', body: JSON.stringify(body) }).then(
    (res) => res.data
  );

export async function fetchExportOrdersEnabled(countryCode?: string): Promise<boolean> {
  const q = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : '';
  const res = await apiRequest<Envelope<{ enabled: boolean }>>(
    `/export-orders/enabled${q}`,
    { method: 'GET' }
  );
  return res.data?.enabled === true;
}

export async function fetchMyExportOrders(page = 1, limit = 20): Promise<ExportOrderPage> {
  const res = await apiRequest<Envelope<ExportOrderPage>>(
    `/export-orders/mine?page=${page}&limit=${limit}`,
    { method: 'GET' }
  );
  return res.data;
}

export async function fetchExportOrder(id: string): Promise<ExportOrderDetail> {
  const res = await apiRequest<Envelope<ExportOrderDetail>>(`/export-orders/${id}`, {
    method: 'GET',
  });
  return res.data;
}

export const postProformaAction = (id: string, action: ProformaAction, notes?: string) =>
  post<ExportOrderDetail>(`/export-orders/${id}/proforma-action`, {
    action,
    notes: notes?.trim() || undefined,
  });

export const postBalanceOption = (id: string, option: BalanceOption) =>
  post<ExportOrderDetail>(`/export-orders/${id}/balance-option`, { option });

export const postConfirmDelivery = (id: string) =>
  post<ExportOrderDetail>(`/export-orders/${id}/confirm-delivery`, {});
