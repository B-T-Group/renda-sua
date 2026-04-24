import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface AdminSiteEventRow {
  id: string;
  event_type: string;
  subject_type: string | null;
  subject_id: string | null;
  subject_display_name?: string | null;
  metadata: Record<string, unknown>;
  viewer_type: string;
  viewer_id: string;
  created_at: string;
}

export type SummaryGroupBy = 'eventType' | 'inventoryItem';

export interface AdminSiteEventSummary {
  total: number;
  groupBy: SummaryGroupBy;
  byEventType: Array<{ eventType: string; count: number }>;
  byInventoryItem: Array<{
    inventoryItemId: string;
    itemName: string | null;
    count: number;
  }>;
  inventoryEventTotal: number;
  inventorySummaryTruncated: boolean;
}

export interface AdminSiteEventsListParams {
  limit: number;
  offset: number;
  eventType?: string;
  subjectType?: string;
  subjectId?: string;
  from?: string;
  to?: string;
}

function appendFilterParams(
  params: URLSearchParams,
  f: Omit<AdminSiteEventsListParams, 'limit' | 'offset'>
) {
  if (f.eventType?.trim()) params.set('eventType', f.eventType.trim());
  if (f.subjectType?.trim()) params.set('subjectType', f.subjectType.trim());
  if (f.subjectId?.trim()) params.set('subjectId', f.subjectId.trim());
  if (f.from?.trim()) params.set('from', f.from.trim());
  if (f.to?.trim()) params.set('to', f.to.trim());
}

export function useAdminSiteEventsApi() {
  const apiClient = useApiClient();
  const [listLoading, setListLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(
    async (p: AdminSiteEventsListParams) => {
      if (!apiClient) {
        return { items: [] as AdminSiteEventRow[], total: 0 };
      }
      setListLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(p.limit));
        params.set('offset', String(p.offset));
        appendFilterParams(params, p);
        const { data } = await apiClient.get<{
          items: AdminSiteEventRow[];
          total: number;
        }>(`/admin/site-events?${params.toString()}`);
        return data;
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (e as Error)?.message || 'Request failed';
        setError(msg);
        return { items: [] as AdminSiteEventRow[], total: 0 };
      } finally {
        setListLoading(false);
      }
    },
    [apiClient]
  );

  const fetchSummary = useCallback(
    async (
      f: Omit<AdminSiteEventsListParams, 'limit' | 'offset'>,
      groupBy: SummaryGroupBy
    ) => {
      if (!apiClient) {
        return emptySummary(groupBy);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        appendFilterParams(params, f);
        params.set('summaryGroupBy', groupBy);
        const { data } = await apiClient.get<AdminSiteEventSummary>(
          `/admin/site-events/summary?${params.toString()}`
        );
        return data;
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (e as Error)?.message || 'Request failed';
        setError(msg);
        return emptySummary(groupBy);
      }
    },
    [apiClient]
  );

  const exportCsv = useCallback(
    async (filters: Omit<AdminSiteEventsListParams, 'limit' | 'offset'>) => {
      if (!apiClient) return;
      setExportLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        appendFilterParams(params, filters);
        const res = await apiClient.get('/admin/site-events/export', {
          params: Object.fromEntries(params.entries()),
          responseType: 'blob',
        });
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'site_events_export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (e as Error)?.message || 'Request failed';
        setError(msg);
        throw e;
      } finally {
        setExportLoading(false);
      }
    },
    [apiClient]
  );

  return { fetchList, fetchSummary, exportCsv, listLoading, exportLoading, error };
}

function emptySummary(groupBy: SummaryGroupBy): AdminSiteEventSummary {
  return {
    total: 0,
    groupBy,
    byEventType: [],
    byInventoryItem: [],
    inventoryEventTotal: 0,
    inventorySummaryTruncated: false,
  };
}
