import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface UserMessage {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    identifier: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface AdminUserMessagesResponse {
  success: boolean;
  messages: UserMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: string;
}

export const useAdminUserMessages = (userId: string) => {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const apiClient = useApiClient();

  const fetchMessages = useCallback(
    async (page = 1, limit = 10) => {
      if (!apiClient || !userId) {
        setError('API client not available or user ID missing');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<AdminUserMessagesResponse>(
          `/admin/users/${userId}/messages`,
          {
            params: { page, limit },
          }
        );

        if (response.data.success) {
          setMessages(response.data.messages);
          setPagination(response.data.pagination);
        } else {
          setError(response.data.error || 'Failed to fetch messages');
          setMessages([]);
        }
      } catch (err: any) {
        console.error('Error fetching user messages:', err);
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to fetch user messages'
        );
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient, userId]
  );

  useEffect(() => {
    if (userId) {
      fetchMessages();
    }
  }, [fetchMessages]);

  const refetch = useCallback(() => {
    return fetchMessages(pagination.page, pagination.limit);
  }, [fetchMessages, pagination.page, pagination.limit]);

  const loadPage = useCallback(
    (page: number) => {
      return fetchMessages(page, pagination.limit);
    },
    [fetchMessages, pagination.limit]
  );

  return {
    messages,
    loading,
    error,
    pagination,
    refetch,
    loadPage,
  };
};
