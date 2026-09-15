import { apiRequest } from './apiClient';

export type ContentReportRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  reporter_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchContentReportsQueue(params: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ rows: ContentReportRow[]; total: number }> {
  const q = new URLSearchParams({
    status: params.status ?? 'pending',
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  const res = await apiRequest<{
    success: boolean;
    data: { rows: ContentReportRow[]; total: number };
  }>(`/content-reports/admin/queue?${q.toString()}`, {
    method: 'GET',
  });
  return res.data;
}

export async function resolveContentReport(
  reportId: string,
  action: 'dismiss' | 'hide_content' | 'warn_merchant',
  resolution?: string
): Promise<void> {
  await apiRequest(`/content-reports/admin/${reportId}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ action, resolution }),
  });
}
