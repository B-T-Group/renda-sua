import { useCallback } from 'react';
import { useApiClient } from './useApiClient';

export function useExportOrders() {
  const api = useApiClient();

  const create = useCallback(
    async (body: {
      businessInventoryId: string;
      quantity?: number;
      characteristics?: string;
      particularities?: string;
      note?: string;
      countryCode?: string;
    }) => {
      const res = await api.post('/export-orders', body);
      return res.data?.data;
    },
    [api]
  );

  const listMine = useCallback(
    async (page = 1, limit = 20, status?: string) => {
      const res = await api.get('/export-orders/mine', {
        params: { page, limit, status },
      });
      return res.data?.data;
    },
    [api]
  );

  const getOne = useCallback(
    async (id: string) => {
      const res = await api.get(`/export-orders/${id}`);
      return res.data?.data;
    },
    [api]
  );

  const getAdminOne = useCallback(
    async (id: string) => {
      const res = await api.get(`/admin/export-orders/${id}`);
      return res.data?.data;
    },
    [api]
  );

  const proformaAction = useCallback(
    async (id: string, action: 'approve' | 'request_adjustment', notes?: string) => {
      const res = await api.post(`/export-orders/${id}/proforma-action`, {
        action,
        notes,
      });
      return res.data?.data;
    },
    [api]
  );

  const selectBalanceOption = useCallback(
    async (id: string, option: 'FULL' | 'FINANCED_30' | 'FINANCED_60') => {
      const res = await api.post(`/export-orders/${id}/balance-option`, {
        option,
      });
      return res.data?.data;
    },
    [api]
  );

  const confirmDelivery = useCallback(
    async (id: string, body?: { reserves?: string; openDispute?: boolean }) => {
      const res = await api.post(`/export-orders/${id}/confirm-delivery`, body || {});
      return res.data?.data;
    },
    [api]
  );

  const listAdmin = useCallback(
    async (page = 1, limit = 20, status?: string) => {
      const res = await api.get('/admin/export-orders', {
        params: { page, limit, status },
      });
      return res.data?.data;
    },
    [api]
  );

  const adminReview = useCallback(
    async (
      id: string,
      decision: 'APPROVE' | 'CHANGES_REQUESTED' | 'REJECT',
      notes?: string
    ) => {
      const res = await api.post(`/admin/export-orders/${id}/review`, {
        decision,
        notes,
      });
      return res.data?.data;
    },
    [api]
  );

  const issueProforma = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const res = await api.post(`/admin/export-orders/${id}/proforma`, body);
      return res.data?.data;
    },
    [api]
  );

  const recordPayment = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const res = await api.post(`/admin/export-finance/orders/${id}/payments`, body);
      return res.data?.data;
    },
    [api]
  );

  const dashboard = useCallback(async () => {
    const res = await api.get('/admin/export-orders/dashboard');
    return res.data?.data;
  }, [api]);

  const listAgent = useCallback(
    async (page = 1, limit = 20) => {
      const res = await api.get('/agent/export-orders', {
        params: { page, limit },
      });
      return res.data?.data;
    },
    [api]
  );

  const listBusiness = useCallback(
    async (page = 1, limit = 20, status?: string) => {
      const res = await api.get('/business/export-orders', {
        params: { page, limit, status },
      });
      return res.data?.data;
    },
    [api]
  );

  return {
    create,
    listMine,
    getOne,
    getAdminOne,
    proformaAction,
    selectBalanceOption,
    confirmDelivery,
    listAdmin,
    adminReview,
    issueProforma,
    recordPayment,
    dashboard,
    listAgent,
    listBusiness,
  };
}
