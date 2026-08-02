import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface PickupOpsHealthRow {
  id: string;
  order_number: string;
  pickup_state: string | null;
  pickup_due_at: string | null;
  assigned_at: string | null;
  reassignment_count: number | null;
  displayHealth: string;
  business?: { name?: string | null } | null;
  assigned_agent?: {
    user?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
}

export interface PickupKpis {
  assignedLiveCount: number;
  byState: Record<string, number>;
  reminderCount: number;
  atRiskCount: number;
  overdueCount: number;
  reassignmentStartedCount: number;
  reassignedCount: number;
  customerDelayNotifications: number;
  merchantDelayCount: number;
  slaComplianceRate: number | null;
  averagePickupDelayMinutes: number | null;
  reassignmentRate: number | null;
}

export function usePickupOpsAdmin() {
  const apiClient = useApiClient();
  const [orders, setOrders] = useState<PickupOpsHealthRow[]>([]);
  const [kpis, setKpis] = useState<PickupKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, kpiRes] = await Promise.all([
        apiClient.get<{ orders: PickupOpsHealthRow[] }>(
          '/admin/pickup-ops/health'
        ),
        apiClient.get<PickupKpis>('/admin/pickup-ops/kpis'),
      ]);
      setOrders(health.data?.orders || []);
      setKpis(kpiRes.data ?? null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pickup ops');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { orders, kpis, loading, error, refresh };
}
