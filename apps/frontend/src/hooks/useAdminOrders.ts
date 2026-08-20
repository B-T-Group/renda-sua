import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    location_name: string;
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
    address_line1: string;
    city: string;
    state: string;
  };
}

export const useAdminOrders = (filters: AdminOrderFilters = {}) => {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.risk_level) params.append('risk_level', filters.risk_level);
      if (filters.search) params.append('search', filters.search);
      if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString());

      const response = await apiClient.get(`/admin/orders?${params.toString()}`);
      return response.data as { orders: OrderWithRisk[]; total: number };
    },
  });
};

export const useUnassignRedispatch = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason?: string;
    }) => {
      const response = await apiClient.post(`/admin/orders/${orderId}/unassign-redispatch`, {
        reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      notes,
    }: {
      orderId: string;
      status: string;
      notes?: string;
    }) => {
      const response = await apiClient.patch(`/admin/orders/${orderId}/status`, {
        status,
        notes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
};

export const useAddAdminNote = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, note }: { orderId: string; note: string }) => {
      const response = await apiClient.post(`/admin/orders/${orderId}/notes`, {
        note,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
};

export const useSendOrderMessage = () => {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      message,
      recipientType,
    }: {
      orderId: string;
      message: string;
      recipientType: 'client' | 'business' | 'agent';
    }) => {
      const response = await apiClient.post(`/admin/orders/${orderId}/contact/message`, {
        message,
        recipient_type: recipientType,
      });
      return response.data;
    },
  });
};

export const useSendOrderEmail = () => {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: async ({
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
      const response = await apiClient.post(`/admin/orders/${orderId}/contact/email`, {
        subject,
        message,
        recipient_type: recipientType,
      });
      return response.data;
    },
  });
};

export const useSendOrderSms = () => {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      message,
      recipientType,
    }: {
      orderId: string;
      message: string;
      recipientType: 'client' | 'business' | 'agent';
    }) => {
      const response = await apiClient.post(`/admin/orders/${orderId}/contact/sms`, {
        message,
        recipient_type: recipientType,
      });
      return response.data;
    },
  });
};
