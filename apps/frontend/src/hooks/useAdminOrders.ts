import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from './useApiClient';

export interface AdminOrderFilters {
  status?: string;
  risk_level?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface OrderWithRisk {
  id: string;
  order_number: string;
  current_status: string;
  risk_score: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  risk_factors: string[];
  created_at: string;
  total_amount: number;
  currency: string;
  fulfillment_method: string;
  client?: {
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
    };
  };
  business?: {
    id: string;
    business_name: string;
    user: {
      email: string;
      phone_number?: string;
    };
  };
  business_location?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  assigned_agent?: {
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
    };
  };
  delivery_time_window?: {
    id: string;
    time_slot_start: string;
    time_slot_end: string;
    preferred_date: string;
  };
  delivery_address?: {
    id: string;
    address_line_1: string;
    city: string;
    state: string;
  };
}

export interface AdminOrdersResponse {
  orders: OrderWithRisk[];
  total: number;
}

export const useAdminOrders = (filters: AdminOrderFilters = {}) => {
  const apiClient = useApiClient();
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.risk_level) params.append('risk_level', filters.risk_level);
      if (filters.search) params.append('search', filters.search);
      if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString());

      const response = await apiClient.get(`/admin/orders?${params.toString()}`);
      setData(response.data);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, filters.status, filters.risk_level, filters.search, filters.offset, filters.limit]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { data, isLoading, error, refetch: fetchOrders };
};

export const useUnassignRedispatch = () => {
  const apiClient = useApiClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      setIsPending(true);
      try {
        const response = await apiClient.post(`/admin/orders/${orderId}/unassign-redispatch`, {
          reason,
        });
        return response.data;
      } finally {
        setIsPending(false);
      }
    },
    [apiClient]
  );

  return { mutateAsync, isPending };
};

export const useUpdateOrderStatus = () => {
  const apiClient = useApiClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async ({ orderId, status, notes }: { orderId: string; status: string; notes?: string }) => {
      setIsPending(true);
      try {
        const response = await apiClient.patch(`/admin/orders/${orderId}/status`, {
          status,
          notes,
        });
        return response.data;
      } finally {
        setIsPending(false);
      }
    },
    [apiClient]
  );

  return { mutateAsync, isPending };
};

export const useAddAdminNote = () => {
  const apiClient = useApiClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async ({ orderId, note }: { orderId: string; note: string }) => {
      setIsPending(true);
      try {
        const response = await apiClient.post(`/admin/orders/${orderId}/notes`, {
          note,
        });
        return response.data;
      } finally {
        setIsPending(false);
      }
    },
    [apiClient]
  );

  return { mutateAsync, isPending };
};

export const useSendOrderMessage = () => {
  const apiClient = useApiClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async ({
      orderId,
      message,
      recipientType,
    }: {
      orderId: string;
      message: string;
      recipientType: 'client' | 'business' | 'agent';
    }) => {
      setIsPending(true);
      try {
        const response = await apiClient.post(`/admin/orders/${orderId}/contact/message`, {
          message,
          recipient_type: recipientType,
        });
        return response.data;
      } finally {
        setIsPending(false);
      }
    },
    [apiClient]
  );

  return { mutateAsync, isPending };
};

export const useSendOrderEmail = () => {
  const apiClient = useApiClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async ({
      orderId,
      subject,
      message,
      recipientType,
    }: {
      orderId: string;
      subject: string;
      message: string;
      recipientType: 'client' | 'business' | 'agent';
    }) => {
      setIsPending(true);
      try {
        const response = await apiClient.post(`/admin/orders/${orderId}/contact/email`, {
          subject,
          message,
          recipient_type: recipientType,
        });
        return response.data;
      } finally {
        setIsPending(false);
      }
    },
    [apiClient]
  );

  return { mutateAsync, isPending };
};

export const useSendOrderSms = () => {
  const apiClient = useApiClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async ({
      orderId,
      message,
      recipientType,
    }: {
      orderId: string;
      message: string;
      recipientType: 'client' | 'business' | 'agent';
    }) => {
      setIsPending(true);
      try {
        const response = await apiClient.post(`/admin/orders/${orderId}/contact/sms`, {
          message,
          recipient_type: recipientType,
        });
        return response.data;
      } finally {
        setIsPending(false);
      }
    },
    [apiClient]
  );

  return { mutateAsync, isPending };
};
