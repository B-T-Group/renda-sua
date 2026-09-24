import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ScheduleAssignmentDetail {
  id: string;
  status: string;
  decision: string;
  amount: number;
  currency: string;
  startsAt: string;
  endsAt: string | null;
  acceptedAt: string | null;
  rejectReason: string | null;
  rejectNote: string | null;
  schedule: { id?: string; name: string; frequency: string };
  targets: {
    agentRecruitments: number | null;
    clientSignups: number | null;
    merchantRecruitments: number | null;
    itemSalesAmount: number | null;
    rentalAmount: number | null;
  };
  progress: {
    agentRecruitments: { actual: number; target: number | null };
    clientSignups: { actual: number; target: number | null };
    merchantRecruitments: { actual: number; target: number | null };
    itemSales: { actual: number; target: number | null };
    rentals: { actual: number; target: number | null };
    completionPercent: number | null;
  };
  runs: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    amount: number;
    status: string;
    failureReason: string | null;
    createdAt: string;
  }>;
}

export function usePaymentScheduleDetail(assignmentId: string) {
  const api = useApiClient();
  const [detail, setDetail] = useState<ScheduleAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/payment-programs/schedules/${assignmentId}`);
      setDetail(response.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payment plan');
    } finally {
      setLoading(false);
    }
  }, [api, assignmentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(async () => {
    const response = await api.post(`/payment-programs/schedules/${assignmentId}/accept`, {});
    setDetail(response.data);
    return response.data;
  }, [api, assignmentId]);

  const defer = useCallback(async () => {
    const response = await api.post(`/payment-programs/schedules/${assignmentId}/defer`, {});
    setDetail(response.data);
    return response.data;
  }, [api, assignmentId]);

  const reject = useCallback(
    async (reason: string, note?: string) => {
      const response = await api.post(`/payment-programs/schedules/${assignmentId}/reject`, {
        reason,
        note: note || undefined,
      });
      setDetail(response.data);
      return response.data;
    },
    [api, assignmentId]
  );

  return { detail, loading, error, refresh, accept, defer, reject };
}
