/**
 * REST API for user_messages — in-app notification feed.
 */

import { api } from './apiClient';
import type { UserMessage } from '../types/messages';

export interface GetMessagesParams {
  entity_type?: string;
  entity_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const messagesApi = {
  list: (params?: GetMessagesParams): Promise<{ success: boolean; messages: UserMessage[] }> => {
    const qs = params
      ? '?' +
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return api.get<{ success: boolean; messages: UserMessage[] }>(`/messages${qs}`);
  },

  getUnreadCount: (): Promise<{ success: boolean; count: number }> =>
    api.get<{ success: boolean; count: number }>('/messages/unread-count'),

  markRead: (id: string): Promise<{ success: boolean }> =>
    api.post<{ success: boolean }>(`/messages/${id}/read`, {}),

  markAllRead: (): Promise<{ success: boolean; count: number }> =>
    api.post<{ success: boolean; count: number }>('/messages/read-all', {}),

  getEntityTypes: (): Promise<{
    success: boolean;
    entity_types: { id: string; comment: string }[];
  }> => api.get('/messages/entity-types'),
};
