/**
 * Location-delegate order APIs (`/delegate/*`). Requires `X-Active-Delegation`.
 */

import { api } from './apiClient';
import type {
  BusinessOrder,
  BusinessOrderFilters,
  ConfirmOrderPayload,
  OrderActionPayload,
} from '../types/business/orders';
import type { OrderActionResponse, OrdersResponse } from '../types/agent';
import type {
  MentionableParticipant,
  OrderMessage,
  QuickMessageTemplate,
} from './agentApi';

function assertActionSuccess<T extends { success?: boolean; message?: string; error?: string }>(
  res: T,
  fallback: string
): T {
  if (res.success === false) {
    throw new Error(res.message || res.error || fallback);
  }
  return res;
}

function buildFiltersQuery(filters?: BusinessOrderFilters): string {
  if (!filters || Object.keys(filters).length === 0) return '';
  const clean = Object.entries(filters).reduce(
    (acc, [key, value]) => {
      if (value !== '' && value != null) acc[key] = value;
      return acc;
    },
    {} as Record<string, unknown>
  );
  if (Object.keys(clean).length === 0) return '';
  return `?filters=${encodeURIComponent(JSON.stringify(clean))}`;
}

export const delegateApi = {
  actionsNeeded: (): Promise<{ success: boolean; pendingOrders?: unknown[] }> =>
    api.get('/delegate/actions-needed'),

  orders: {
    list: (filters?: BusinessOrderFilters): Promise<OrdersResponse> =>
      api.get<OrdersResponse>(`/delegate/orders${buildFiltersQuery(filters)}`),

    getById: (orderId: string): Promise<{ success: boolean; order: BusinessOrder }> =>
      api.get<{ success: boolean; order: BusinessOrder }>(`/delegate/orders/${orderId}`),

    confirm: async (body: ConfirmOrderPayload): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>('/delegate/orders/confirm', body);
      return assertActionSuccess(res, 'Failed to confirm order');
    },

    completePreparation: async (body: OrderActionPayload): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>(
        '/delegate/orders/complete_preparation',
        body
      );
      return assertActionSuccess(res, 'Failed to complete preparation');
    },

    markShipped: async (
      orderId: string,
      body?: { tracking_number?: string; carrier?: string }
    ): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>(
        `/delegate/orders/${orderId}/mark-shipped`,
        body ?? {}
      );
      return assertActionSuccess(res, 'Failed to mark order as shipped');
    },

    updateTracking: async (
      orderId: string,
      body: { tracking_number: string; carrier?: string }
    ): Promise<OrderActionResponse> => {
      const res = await api.patch<OrderActionResponse>(
        `/delegate/orders/${orderId}/tracking`,
        body
      );
      return assertActionSuccess(res, 'Failed to update tracking');
    },

    cancel: async (body: OrderActionPayload): Promise<OrderActionResponse> => {
      const res = await api.post<OrderActionResponse>('/delegate/orders/cancel', body);
      return assertActionSuccess(res, 'Failed to cancel order');
    },

    getCancellationPreview: (orderId: string) =>
      api.get(`/delegate/orders/${orderId}/cancellation-preview`),

    confirmClientPickup: async (
      orderId: string,
      pin: string,
      options?: { useLatestSharedPin?: boolean; pinMessageId?: string }
    ): Promise<{ success: boolean; message?: string }> => {
      const res = await api.post<{ success: boolean; message?: string }>(
        `/delegate/orders/${orderId}/confirm-pickup`,
        {
          pin: pin || undefined,
          useLatestSharedPin: options?.useLatestSharedPin,
          pinMessageId: options?.pinMessageId,
        }
      );
      return assertActionSuccess(res, 'Failed to confirm pickup');
    },

    getActiveDeliveryPin: async (
      orderId: string
    ): Promise<{
      messageId: string;
      pin: string;
      pinVersion: number;
      sharedAt: string;
    } | null> => {
      const res = await api.get<{
        success: boolean;
        pin?: {
          messageId: string;
          pin: string;
          pinVersion: number;
          sharedAt: string;
        } | null;
        activePin?: {
          messageId: string;
          pin: string;
          pinVersion: number;
          sharedAt: string;
        } | null;
      }>(`/delegate/orders/${orderId}/messages/active-delivery-pin`);
      return res?.activePin ?? res?.pin ?? null;
    },

    initiatePayAtPickupPayment: async (
      orderId: string,
      body?: { phone_number?: string }
    ): Promise<{ success: boolean; message?: string }> => {
      const res = await api.post<{ success: boolean; message?: string }>(
        `/delegate/orders/${orderId}/initiate-pay-at-pickup-payment`,
        body ?? {}
      );
      return assertActionSuccess(res, 'Failed to request pickup payment');
    },

    getMessages: (orderId: string): Promise<{ success: boolean; messages: OrderMessage[]; error?: string }> =>
      api.get(`/delegate/orders/${orderId}/messages`),

    sendMessage: (
      orderId: string,
      message: string,
      mentionedUserId?: string
    ): Promise<{ success: boolean; message?: OrderMessage }> =>
      api.post(`/delegate/orders/${orderId}/messages`, { message, mentionedUserId }),

    getMentionableParticipants: (
      orderId: string
    ): Promise<{ success: boolean; participants: MentionableParticipant[] }> =>
      api.get(`/delegate/orders/${orderId}/mentionable-participants`),

    getQuickMessageTemplates: async (
      orderId: string
    ): Promise<QuickMessageTemplate[]> => {
      const res = await api.get<{
        success: boolean;
        templates: QuickMessageTemplate[];
      }>(`/delegate/orders/${orderId}/messages/quick-templates`);
      return res?.templates ?? [];
    },

    sendQuickMessage: async (orderId: string, templateId: string): Promise<void> => {
      const res = await api.post<{ success: boolean }>(
        `/delegate/orders/${orderId}/messages/quick`,
        { templateId }
      );
      if (!res?.success) throw new Error('Failed to send quick message');
    },
  },

  failedDeliveries: {
    list: (params?: { status?: string; resolution_type?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.resolution_type) q.set('resolution_type', params.resolution_type);
      const qs = q.toString();
      return api.get(`/delegate/failed-deliveries${qs ? `?${qs}` : ''}`);
    },
    resolve: (orderId: string, body: unknown) =>
      api.post(`/delegate/failed-deliveries/${orderId}/resolve`, body),
  },
};
